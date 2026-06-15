import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Public } from '../common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Readiness: are our hard dependencies (DB, Redis) reachable? */
  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe (database + redis)' })
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkRedis(),
    ]);
  }

  /** Liveness: is the process up at all? Cheap, no dependency calls. */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  live(): { status: string; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (e) {
      throw new HealthCheckError('Database unavailable', {
        database: { status: 'down', message: (e as Error).message },
      });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.client.ping();
      if (pong !== 'PONG') throw new Error('unexpected ping reply');
      return { redis: { status: 'up' } };
    } catch (e) {
      throw new HealthCheckError('Redis unavailable', {
        redis: { status: 'down', message: (e as Error).message },
      });
    }
  }
}
