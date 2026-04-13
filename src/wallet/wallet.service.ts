import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deposit(userId: string, amountCents: number) {
    this.logger.log(`Depositing ${amountCents} cents to user ${userId}`);
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { balanceCents: { increment: amountCents } },
        select: { id: true, email: true, name: true, balanceCents: true },
      });
      this.logger.log(`Deposit successful for user ${userId}: new balance = ${user.balanceCents} cents`);
      return { user };
    } catch (error) {
      this.logger.error(`Error depositing funds for user ${userId}: ${error.message}`);
      throw error;
    }
  }
}

