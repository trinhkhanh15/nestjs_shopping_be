import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ID = 'admin';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deposit(userId: string, amountCents: number) {
    this.logger.log(`Depositing ${amountCents} cents to user ${userId}`);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1) Update user balance
        const user = await tx.user.update({
          where: { id: userId },
          data: { balanceCents: { increment: amountCents } },
          select: { id: true, email: true, name: true, balanceCents: true },
        });

        // 2) Create transaction record from admin
        const txn = await tx.transaction.create({
          data: {
            from_user: ADMIN_ID,
            to_user: userId,
            moneyAmountCents: amountCents,
            product_id: '00000000-0000-0000-0000-000000000000', // Null UUID for system deposits
          },
        });

        this.logger.log(`Deposit successful for user ${userId}: new balance = ${user.balanceCents} cents, transaction=${txn.id}`);
        return { user, transaction: txn };
      });
      return result;
    } catch (error) {
      this.logger.error(`Error depositing funds for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

