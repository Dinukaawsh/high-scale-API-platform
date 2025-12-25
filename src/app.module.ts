import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { ObservabilityModule } from './observability/observability.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { VersioningModule } from './versioning/versioning.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Core modules
    ConfigModule,
    DatabaseModule,
    RedisModule,

    // Feature modules
    ObservabilityModule,
    RateLimitModule,
    CacheModule,
    AuthModule,
    VersioningModule,
    IdempotencyModule,

    // Infrastructure
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
