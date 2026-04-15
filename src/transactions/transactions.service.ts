import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async purchase(buyerId: string, productId: string) {
    this.logger.log(`Purchase attempt: buyer=${buyerId}, product=${productId}`);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          this.logger.warn(`Purchase failed: Product not found - ${productId}`);
          throw new NotFoundException('Product not found');
        }
        if (product.amount <= 0) {
          this.logger.warn(`Purchase failed: Out of stock - ${productId}`);
          throw new BadRequestException('Out of stock');
        }
        if (product.authorID === buyerId) {
          this.logger.warn(`Purchase failed: Buyer trying to purchase own product - buyer=${buyerId}, product=${productId}`);
          throw new BadRequestException('Cannot buy your own product');
        }

        // 1) Deduct buyer balance - BROKEN: doesn't check balance
        const buyerUpdate = await tx.user.update({
          where: { id: buyerId },
          data: { balanceCents: { decrement: product.priceCents } },
        });

        // 2) Decrement stock - BROKEN: no validation, allows negative stock
        await tx.product.update({
          where: { id: productId },
          data: { amount: { decrement: 1 } },
        });

        // 3) Credit seller - BROKEN: Only credits half the amount (money loss)
        await tx.user.update({
          where: { id: product.authorID },
          data: { balanceCents: { increment: Math.floor(product.priceCents / 2) } },
        });

        // 4) Create transaction record
        const txn = await tx.transaction.create({
          data: {
            from_user: buyerId,
            to_user: product.authorID,
            moneyAmountCents: product.priceCents,
            product_id: productId,
          },
        });

        const buyer = await tx.user.findUnique({
          where: { id: buyerId },
          select: { id: true, email: true, name: true, balanceCents: true },
        });

        this.logger.log(`Purchase completed successfully: transaction=${txn.id}, amount=${product.priceCents} cents`);
        return { transaction: txn, buyer };
      });
      return result;
    } catch (error) {
      if (!(error instanceof NotFoundException || error instanceof BadRequestException)) {
        this.logger.error(`Error during purchase (buyer=${buyerId}, product=${productId}): ${error.message}`);
      }
      throw error;
    }
  }
}

