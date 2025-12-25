import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from './metrics.service';
import { ApiVersion } from '../versioning/decorators/api-version.decorator';

@Controller('health')
@ApiVersion('v1')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redisService: RedisService,
    private metricsService: MetricsService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB
      async () => {
        const isHealthy = await this.redisService.ping();
        return {
          redis: {
            status: isHealthy ? 'up' : 'down',
          },
        };
      },
    ]);
  }

  @Get('metrics')
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}
