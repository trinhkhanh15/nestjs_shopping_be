# Testing Guide - Unit & Integration Tests

This guide explains how to run, understand, and write tests for the shopping application's core purchase transaction logic.

## Overview

The testing suite covers:
- **Unit Tests** (`transactions.service.spec.ts`) - Test isolated business logic with mocked dependencies
- **Integration Tests** (`purchase.e2e-spec.ts`) - Test complete purchase flow with real database

## Running Tests

### Prerequisites

Ensure services are running:
```bash
docker-compose up -d
npm install
```

### Run All Tests
```bash
npm test
```

**Output:**
```
 PASS  src/transactions/transactions.service.spec.ts
  TransactionsService - Unit Tests
    purchase
      ✓ should successfully purchase a product
      ✓ should throw NotFoundException if product does not exist
      ✓ should throw BadRequestException if product is out of stock
      ...
      Tests:       8 passed, 8 total
      Snapshots:   0 total
      Time:        2.345s
```

### Run Unit Tests Only
```bash
npm test -- transactions.service.spec
```

### Run Integration Tests Only
```bash
npm test -- purchase.e2e-spec
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

Re-runs tests when files change. Press `q` to quit.

### Run Tests with Coverage Report
```bash
npm run test:cov
```

**Output:** Shows line-by-line coverage with HTML report in `coverage/` directory

### Run Specific Test Case
```bash
npm test -- -t "should successfully purchase a product"
```

### Debug Tests
```bash
npm run test:debug
```

Then open Chrome DevTools at `chrome://inspect`

## Test Structure

### Unit Tests: `src/transactions/transactions.service.spec.ts`

Tests the `TransactionsService.purchase()` method in isolation using mocked Prisma:

```typescript
describe('TransactionsService - Unit Tests', () => {
  describe('purchase', () => {
    it('should successfully purchase a product', async () => {
      // Arrange - Set up mocks
      const mockTx = { /* ... */ };
      
      // Act - Call the method
      const result = await service.purchase('user-1', 'product-1');
      
      // Assert - Verify results
      expect(result.transaction).toEqual(mockTransaction);
    });
  });
});
```

**What's tested:**
1. ✅ Successful purchase flow
2. ✅ Product not found error
3. ✅ Out of stock error
4. ✅ Cannot buy own product error
5. ✅ Insufficient balance error
6. ✅ Stock conflict during transaction
7. ✅ Seller credit logic
8. ✅ Transaction record creation

**Advantages:**
- Fast execution (< 1s)
- Isolated logic testing
- Easy to debug
- No database required

### Integration Tests: `test/purchase.e2e-spec.ts`

Tests complete purchase flow with real database and authentication:

```typescript
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
  });

  it('should successfully purchase product', async () => {
    const response = await request(app.getHttpServer())
      .post('/transactions/purchase')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId: productId })
      .expect(201);
  });
});
```

**Test Scenarios:**
1. ✅ User registration (buyer & seller)
2. ✅ Wallet deposit
3. ✅ Product creation
4. ✅ Purchase success
5. ✅ Stock update after purchase
6. ✅ Insufficient balance rejection
7. ✅ Out of stock rejection
8. ✅ Cannot buy own product rejection
9. ✅ Seller balance credit
10. ✅ Cache invalidation on purchase
11. ✅ Cache invalidation on product create/update
12. ✅ Manual cache clearing

**Advantages:**
- Real database integration
- Tests entire request-response cycle
- Verifies API contracts
- Tests authentication flow
- Tests cache behavior

## Understanding Test Output

### Successful Run
```
 PASS  src/transactions/transactions.service.spec.ts (2.345s)
  ✓ should successfully purchase a product
  ✓ should throw NotFoundException
  
Tests:       8 passed, 8 total
```

### Failed Test
```
 FAIL  src/transactions/transactions.service.spec.ts
  ✕ should successfully purchase a product
    Expected: 10000
    Received: 5000
    
  Tests:       1 failed, 7 passed
```

## Common Testing Patterns

### Pattern 1: Testing Success Path
```typescript
it('should successfully purchase a product', async () => {
  // Setup mocks to return valid data
  mockTx.product.findUnique.mockResolvedValue(mockProduct);
  mockTx.user.updateMany.mockResolvedValue({ count: 1 });

  const result = await service.purchase('user-1', 'product-1');

  expect(result.transaction.id).toBeDefined();
  expect(result.buyer.balanceCents).toBe(9000); // 10000 - 1000
});
```

### Pattern 2: Testing Error Cases
```typescript
it('should throw BadRequestException if insufficient balance', async () => {
  // Setup mocks to simulate insufficient balance
  mockTx.user.updateMany.mockResolvedValue({ count: 0 });

  await expect(service.purchase('user-1', 'product-1'))
    .rejects
    .toThrow(new BadRequestException('Insufficient balance'));
});
```

### Pattern 3: Testing API Endpoint
```typescript
it('should deposit funds to wallet', async () => {
  const response = await request(app.getHttpServer())
    .post('/wallet/deposit')
    .set('Authorization', `Bearer ${token}`)
    .send({ amountCents: 50000 })
    .expect(201); // Assert HTTP status

  expect(response.body.user.balanceCents).toBe(50000); // Assert response data
});
```

### Pattern 4: Testing Cache Invalidation
```typescript
it('should invalidate cache after purchase', async () => {
  // Get product before purchase
  const beforeResponse = await request(app.getHttpServer())
    .get(`/products/${productId}`);
    
  const beforeAmount = beforeResponse.body.amount;

  // Make purchase (should invalidate cache)
  await request(app.getHttpServer())
    .post('/transactions/purchase')
    .set('Authorization', `Bearer ${buyerToken}`)
    .send({ productId })
    .expect(201);

  // Get product after purchase (fresh from DB)
  const afterResponse = await request(app.getHttpServer())
    .get(`/products/${productId}`);

  expect(afterResponse.body.amount).toBe(beforeAmount - 1);
});
```

## Test Data & Mocks

### Unit Test Mock Data
```typescript
const mockUser = {
  id: 'user-1',
  email: 'buyer@test.com',
  name: 'Test Buyer',
  balanceCents: 10000,
};

const mockProduct = {
  id: 'product-1',
  name: 'Test Product',
  amount: 5,
  priceCents: 1000,
  authorID: 'seller-1',
};
```

### Integration Test Data
Uses real data created during test execution:
- Email: `buyer@test.com` / `seller@test.com`
- Passwords: `buyer123` / `seller123`
- Initial balance: 50000 cents ($500)
- Product price: 10000 cents ($100)

## Jest Configuration

Tests use Jest with the following config (in `package.json`):

```json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "testEnvironment": "node",
    "maxWorkers": 1
  }
}
```

## Troubleshooting

### Issue: Tests hang or timeout
**Solution:** Increase Jest timeout:
```bash
npm test -- --testTimeout=10000
```

### Issue: Database connection errors in integration tests
**Solution:** Ensure PostgreSQL is running:
```bash
docker-compose up -d && npm test
```

### Issue: Mock not being called
**Solution:** Check mock setup:
```typescript
// ✅ Correct: Call mockResolvedValue on the mock
mockTx.user.updateMany.mockResolvedValue({ count: 1 });

// ❌ Wrong: Forgetting to setup mock
// mockTx.user.updateMany without setup
```

### Issue: Token expired in E2E tests
**Solution:** Tokens generated in tests are valid for entire test suite duration. If individual tests take > 15 minutes, they fail.

## Writing New Tests

### Unit Test Template
```typescript
describe('MyService', () => {
  let service: MyService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: PrismaService, useValue: { /* mocks */ } },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should do something', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Integration Test Template
```typescript
describe('MyEndpoint - E2E', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should do something', async () => {
    const response = await request(app.getHttpServer())
      .post('/endpoint')
      .set('Authorization', `Bearer ${token}`)
      .send({ data: 'value' })
      .expect(200);

    expect(response.body).toHaveProperty('result');
  });
});
```

## CI/CD Integration

To run tests in CI/CD pipeline:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: 123
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run test:cov
      - uses: codecov/codecov-action@v2
```

## Next Steps

1. **Add more unit tests** for error edge cases
2. **Add performance tests** for cache hit/miss rates
3. **Add load tests** for concurrent purchases
4. **Set up code coverage** to reach > 80% coverage
5. **Integrate with CI/CD** pipeline

## Resources

- [NestJS Testing Docs](https://docs.nestjs.com/fundamentals/testing)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest (HTTP assertions)](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
