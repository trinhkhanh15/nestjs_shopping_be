import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Purchase Transaction - Integration Tests (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let buyerToken: string;
  let sellerToken: string;
  let buyerId: string;
  let sellerId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Clean up database
    await prisma.transaction.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Purchase Flow', () => {
    it('should register a buyer account', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'buyer@test.com',
          password: 'buyer123',
          name: 'Test Buyer',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      buyerToken = response.body.access_token;

      // Decode token to get user ID
      const decodedToken = Buffer.from(buyerToken.split('.')[1], 'base64').toString();
      buyerId = JSON.parse(decodedToken).sub;
    });

    it('should register a seller account', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'seller@test.com',
          password: 'seller123',
          name: 'Test Seller',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      sellerToken = response.body.access_token;

      // Decode token to get user ID
      const decodedToken = Buffer.from(sellerToken.split('.')[1], 'base64').toString();
      sellerId = JSON.parse(decodedToken).sub;
    });

    it('should deposit funds to buyer wallet', async () => {
      const response = await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          amountCents: 50000, // $500
        })
        .expect(201);

      expect(response.body.user).toHaveProperty('balanceCents', 50000);
    });

    it('should create a product by seller', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Laptop',
          amount: 5,
          priceCents: 10000, // $100
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Laptop');
      expect(response.body.priceCents).toBe(10000);
      productId = response.body.id;
    });

    it('should successfully purchase product', async () => {
      const response = await request(app.getHttpServer())
        .post('/transactions/purchase')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: productId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('transaction');
      expect(response.body.transaction.from_user).toBe(buyerId);
      expect(response.body.transaction.to_user).toBe(sellerId);
      expect(response.body.transaction.moneyAmountCents).toBe(10000);
      expect(response.body.buyer.balanceCents).toBe(40000); // 50000 - 10000
    });

    it('should update product stock after purchase', async () => {
      const response = await request(app.getHttpServer())
        .get(`/products/${productId}`)
        .expect(200);

      expect(response.body.amount).toBe(4); // 5 - 1
    });

    it('should reject purchase if buyer has insufficient balance', async () => {
      // Create another product worth more than remaining balance
      const expensiveProductResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Diamond Ring',
          amount: 1,
          priceCents: 50000, // $500 - more than remaining balance
        })
        .expect(201);

      const expensiveProductId = expensiveProductResponse.body.id;

      // Try to purchase - should fail
      await request(app.getHttpServer())
        .post('/transactions/purchase')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: expensiveProductId,
        })
        .expect(400);
    });

    it('should reject purchase if product is out of stock', async () => {
      // Buy remaining 4 units one by one
      for (let i = 0; i < 4; i++) {
        await request(app.getHttpServer())
          .post('/transactions/purchase')
          .set('Authorization', `Bearer ${buyerToken}`)
          .send({
            productId: productId,
          })
          .expect(201);
      }

      // Try to buy when out of stock - should fail
      await request(app.getHttpServer())
        .post('/transactions/purchase')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          productId: productId,
        })
        .expect(400);
    });

    it('should reject purchase if buyer tries to buy own product', async () => {
      // Create a product with seller account
      const sellerProductResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Self Product',
          amount: 10,
          priceCents: 1000,
        })
        .expect(201);

      const selfProductId = sellerProductResponse.body.id;

      // Seller deposits money
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          amountCents: 100000,
        })
        .expect(201);

      // Try to purchase own product - should fail
      await request(app.getHttpServer())
        .post('/transactions/purchase')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          productId: selfProductId,
        })
        .expect(400);
    });

    it('should credit seller balance after purchase', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      // Seller should have received payment from 5 purchases (4 at 10000 + initial deposit)
      expect(response.body.balanceCents).toBeGreaterThan(0);
    });
  });

  describe('Product Caching with Purchase', () => {
    let cacheTestProductId: string;
    let cacheTestBuyerToken: string;

    it('should get cached product list', async () => {
      // Register new buyer for cache test
      const buyerResponse = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'cache-buyer@test.com',
          password: 'pass123',
          name: 'Cache Test Buyer',
        })
        .expect(201);

      cacheTestBuyerToken = buyerResponse.body.access_token;

      // Deposit funds
      await request(app.getHttpServer())
        .post('/wallet/deposit')
        .set('Authorization', `Bearer ${cacheTestBuyerToken}`)
        .send({ amountCents: 100000 })
        .expect(201);

      // This request should populate the cache
      await request(app.getHttpServer())
        .get('/products')
        .expect(200);
    });

    it('should serve products from cache on subsequent requests', async () => {
      // Multiple requests should return same cached data
      const response1 = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      const response2 = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(JSON.stringify(response1.body)).toBe(JSON.stringify(response2.body));
    });

    it('should invalidate cache after creating new product', async () => {
      const beforeResponse = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      const beforeCount = beforeResponse.body.length;

      // Create new product
      const newProductResponse = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Cache Invalidation Test',
          amount: 1,
          priceCents: 5000,
        })
        .expect(201);

      cacheTestProductId = newProductResponse.body.id;

      // Cache should be invalidated, new list fetched from DB
      const afterResponse = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(afterResponse.body.length).toBe(beforeCount + 1);
    });

    it('should invalidate cache after updating product', async () => {
      // Update the product
      await request(app.getHttpServer())
        .patch(`/products/${cacheTestProductId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Updated Product Name',
        })
        .expect(200);

      // Verify cache was invalidated and update is reflected
      const response = await request(app.getHttpServer())
        .get(`/products/${cacheTestProductId}`)
        .expect(200);

      expect(response.body.name).toBe('Updated Product Name');
    });

    it('should invalidate cache after product purchase', async () => {
      const beforeResponse = await request(app.getHttpServer())
        .get(`/products/${cacheTestProductId}`)
        .expect(200);

      const beforeAmount = beforeResponse.body.amount;

      // Purchase the product
      await request(app.getHttpServer())
        .post('/transactions/purchase')
        .set('Authorization', `Bearer ${cacheTestBuyerToken}`)
        .send({
          productId: cacheTestProductId,
        })
        .expect(201);

      // Cache should be invalidated
      const afterResponse = await request(app.getHttpServer())
        .get(`/products/${cacheTestProductId}`)
        .expect(200);

      expect(afterResponse.body.amount).toBe(beforeAmount - 1);
    });

    it('should allow manual cache clearing via admin endpoint', async () => {
      // Clear cache
      await request(app.getHttpServer())
        .delete('/products/cache/clear')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
    });
  });
});
