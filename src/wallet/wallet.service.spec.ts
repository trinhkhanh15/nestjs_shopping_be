import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WalletService - Unit Tests', () => {
  let service: WalletService;
  let prismaService: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'user@test.com',
    name: 'Test User',
    balanceCents: 10000,
  };

  const mockTransaction = {
    id: 'deposit-txn-1',
    from_user: 'admin',
    to_user: 'user-1',
    moneyAmountCents: 5000,
    product_id: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deposit', () => {
    it('should successfully deposit funds and create transaction', async () => {
      const mockTx = {
        user: {
          update: jest.fn().mockResolvedValue({ ...mockUser, balanceCents: 15000 }),
        },
        transaction: {
          create: jest.fn().mockResolvedValue(mockTransaction),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      const result = await service.deposit('user-1', 5000);

      expect(result.user.balanceCents).toBe(15000);
      expect(result.transaction.from_user).toBe('admin');
      expect(result.transaction.to_user).toBe('user-1');
      expect(result.transaction.moneyAmountCents).toBe(5000);
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { balanceCents: { increment: 5000 } },
        select: { id: true, email: true, name: true, balanceCents: true },
      });
      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          from_user: 'admin',
          to_user: 'user-1',
          moneyAmountCents: 5000,
          product_id: null,
        },
      });
    });

    it('should handle large deposit amounts', async () => {
      const largeAmount = 1000000; // 10,000 units
      const mockTx = {
        user: {
          update: jest
            .fn()
            .mockResolvedValue({ ...mockUser, balanceCents: largeAmount }),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({
            ...mockTransaction,
            moneyAmountCents: largeAmount,
          }),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      const result = await service.deposit('user-1', largeAmount);

      expect(result.user.balanceCents).toBe(largeAmount);
      expect(result.transaction.moneyAmountCents).toBe(largeAmount);
    });

    it('should throw error if user does not exist', async () => {
      const mockTx = {
        user: {
          update: jest.fn().mockRejectedValue(new Error('User not found')),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await expect(service.deposit('non-existent', 5000)).rejects.toThrow(
        'User not found',
      );
    });

    it('should create transaction with system deposit product_id', async () => {
      const mockTx = {
        user: {
          update: jest.fn().mockResolvedValue(mockUser),
        },
        transaction: {
          create: jest.fn().mockResolvedValue(mockTransaction),
        },
      };

      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(mockTx),
      );

      await service.deposit('user-1', 5000);

      expect(mockTx.transaction.create).toHaveBeenCalledWith({
        data: {
          from_user: 'admin',
          to_user: 'user-1',
          moneyAmountCents: 5000,
          product_id: '00000000-0000-0000-0000-000000000000',
        },
      });
    });

    it('should use atomic transaction to ensure consistency', async () => {
      const mockCallback = jest.fn().mockResolvedValue({
        user: mockUser,
        transaction: mockTransaction,
      });

      (prismaService.$transaction as jest.Mock).mockImplementation(mockCallback);

      await service.deposit('user-1', 5000);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalled();
    });
  });
});
