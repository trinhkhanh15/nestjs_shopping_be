import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TransactionsService - Unit Tests', () => {
  let service: TransactionsService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'buyer@test.com',
    name: 'Test Buyer',
    balanceCents: 10000,
  };

  const mockSeller = {
    id: 'seller-1',
    email: 'seller@test.com',
    name: 'Test Seller',
    balanceCents: 0,
  };

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    amount: 5,
    priceCents: 1000,
    authorID: 'seller-1',
    createdAt: new Date(),
  };

  const mockTransaction = {
    id: 'txn-1',
    from_user: 'user-1',
    to_user: 'seller-1',
    moneyAmountCents: 1000,
    product_id: 'product-1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('purchase', () => {
    it('should successfully purchase a product', async () => {
      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue(mockSeller),
          findUnique: jest.fn().mockResolvedValue({ ...mockUser, balanceCents: 9000 }),
        },
        transaction: {
          create: jest.fn().mockResolvedValue(mockTransaction),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      const result = await service.purchase('user-1', 'product-1');

      expect(result.transaction).toEqual(mockTransaction);
      expect(result.buyer?.balanceCents).toBe(9000);
      expect(mockTx.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', balanceCents: { gte: 1000 } },
        data: { balanceCents: { decrement: 1000 } },
      });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      const mockTx = {
        product: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.purchase('user-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if product is out of stock', async () => {
      const outOfStockProduct = { ...mockProduct, amount: 0 };

      const mockTx = {
        product: { findUnique: jest.fn().mockResolvedValue(outOfStockProduct) },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.purchase('user-1', 'product-1')).rejects.toThrow(
        new BadRequestException('Out of stock'),
      );
    });

    it('should throw BadRequestException if buyer tries to purchase own product', async () => {
      const ownProduct = { ...mockProduct, authorID: 'user-1' };

      const mockTx = {
        product: { findUnique: jest.fn().mockResolvedValue(ownProduct) },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.purchase('user-1', 'product-1')).rejects.toThrow(
        new BadRequestException('Cannot buy your own product'),
      );
    });

    it('should throw BadRequestException if buyer has insufficient balance', async () => {
      const mockTx = {
        product: { findUnique: jest.fn().mockResolvedValue(mockProduct) },
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }), // No users updated (insufficient balance)
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.purchase('user-1', 'product-1')).rejects.toThrow(
        new BadRequestException('Insufficient balance'),
      );
    });

    it('should throw BadRequestException if stock is unavailable during transaction', async () => {
      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }), // Balance deducted successfully
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.purchase('user-1', 'product-1')).rejects.toThrow(
        new BadRequestException('Out of stock'),
      );
    });

    it('should credit seller after successful purchase', async () => {
      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue(mockSeller),
          findUnique: jest.fn().mockResolvedValue(mockUser),
        },
        transaction: {
          create: jest.fn().mockResolvedValue(mockTransaction),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await service.purchase('user-1', 'product-1');

      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'seller-1' },
        data: { balanceCents: { increment: 1000 } },
      });
    });

    it('should create transaction record with correct data', async () => {
      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn().mockResolvedValue(mockSeller),
          findUnique: jest.fn().mockResolvedValue(mockUser),
        },
        transaction: {
          create: jest.fn().mockResolvedValue(mockTransaction),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await service.purchase('user-1', 'product-1');

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          from_user: 'user-1',
          to_user: 'seller-1',
          moneyAmountCents: 1000,
          product_id: 'product-1',
        },
      });
    });
  });
});
