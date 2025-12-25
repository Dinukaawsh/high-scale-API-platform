import { SetMetadata } from '@nestjs/common';
import {
  RATE_LIMIT_KEY,
  RateLimitMetadata,
} from '../guards/token-bucket-rate-limit.guard';

export const RateLimit = (metadata: RateLimitMetadata) =>
  SetMetadata(RATE_LIMIT_KEY, metadata);
