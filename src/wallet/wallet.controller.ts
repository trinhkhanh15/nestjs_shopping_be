import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepositDto } from './dto/deposit.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly wallet: WalletService) {}

  @Post('deposit')
  async deposit(@Req() req: any, @Body() body: DepositDto) {
    this.logger.log(`POST /wallet/deposit: user=${req.user.id}, amount=${body.amountCents} cents`);
    return await this.wallet.deposit(req.user.id, body.amountCents);
  }
}

