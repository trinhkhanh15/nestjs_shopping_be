import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PurchaseDto } from './dto/purchase.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  private readonly logger = new Logger(TransactionsController.name);

  constructor(private readonly txns: TransactionsService) {}

  @Post('purchase')
  async purchase(@Req() req: any, @Body() body: PurchaseDto) {
    this.logger.log(`POST /transactions/purchase: user=${req.user.id}, product=${body.productId}`);
    return await this.txns.purchase(req.user.id, body.productId);
  }
}

