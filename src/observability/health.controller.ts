import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from './metrics.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
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
  @Version('1')
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
    // Use environment variable for memory thresholds, default to higher values for CI
    const heapThreshold = parseInt(
      process.env.HEALTH_HEAP_THRESHOLD || '300',
      10,
    );
    const rssThreshold = parseInt(
      process.env.HEALTH_RSS_THRESHOLD || '500',
      10,
    );

    return this.health.check([
      () => this.db.pingCheck('database'),
      () =>
        this.memory.checkHeap(
          'memory_heap',
          heapThreshold * 1024 * 1024, // MB
        ),
      () => this.memory.checkRSS('memory_rss', rssThreshold * 1024 * 1024), // MB
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
  @Version('1')
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
