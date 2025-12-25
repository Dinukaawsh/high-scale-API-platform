import { Module, Global } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [RedisModule],
  providers: [
    IdempotencyService,
    {
      provide: 'IdempotencyService',
      useExisting: IdempotencyService,
    },
  ],
  exports: [IdempotencyService, 'IdempotencyService'],
})
export class IdempotencyModule {}
