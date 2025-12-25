import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from './metrics.service';
import { ApiVersion } from '../versioning/decorators/api-version.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
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

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          properties: {
            database: { type: 'object' },
            memory_heap: { type: 'object' },
            memory_rss: { type: 'object' },
            redis: { type: 'object' },
          },
        },
      },
    },
  })
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

  @Public()
  @Get('metrics')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({
    status: 200,
    description: 'Prometheus-compatible metrics',
    schema: {
      type: 'string',
      example:
        '# HELP http_requests_total Total number of HTTP requests\n# TYPE http_requests_total counter\n...',
    },
  })
  async getMetrics() {
    return this.metricsService.getMetrics();
  }
}
