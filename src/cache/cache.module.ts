import { Module, forwardRef } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { RedisModule } from '../redis/redis.module';
import { ObservabilityModule } from '../observability/observability.module';

@Module({
  imports: [RedisModule, forwardRef(() => ObservabilityModule)],
  providers: [CacheService, CacheInvalidationService],
  exports: [CacheService, CacheInvalidationService],
})
export class CacheModule {}
