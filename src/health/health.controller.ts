import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly health: HealthService) {}

  @Get()
  async getHealth() {
    this.logger.debug('GET /health: performing health check');
    return this.health.check();
  }
}

