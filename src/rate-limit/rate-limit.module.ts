import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { TokenBucketRateLimitGuard } from './guards/token-bucket-rate-limit.guard';

@Module({
  providers: [
    RateLimitService,
    {
      provide: APP_GUARD,
      useClass: TokenBucketRateLimitGuard,
    },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
