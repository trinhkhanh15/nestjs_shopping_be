import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check() {
    this.logger.debug('Health check started');
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startedAt;
      this.logger.log(`Health check passed: db=ok, latency=${latencyMs}ms`);
      return {
        status: 'ok',
        db: 'ok',
        ts: new Date().toISOString(),
        latencyMs,
      };
    } catch (e) {
      const latencyMs = Date.now() - startedAt;
      this.logger.error(`Health check failed: db=down, latency=${latencyMs}ms, error=${e.message}`);
      return {
        status: 'degraded',
        db: 'down',
        ts: new Date().toISOString(),
        latencyMs,
      };
    }
  }
}

