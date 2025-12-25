import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { MetricsService } from './metrics.service';
import { LoggingService } from './logging.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [TerminusModule, TypeOrmModule, RedisModule],
  providers: [
    MetricsService,
    LoggingService,
    {
      provide: 'MetricsService',
      useExisting: MetricsService,
    },
  ],
  controllers: [HealthController],
  exports: [MetricsService, LoggingService, 'MetricsService'],
})
export class ObservabilityModule {}
