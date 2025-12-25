import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  CanActivate,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from '../rate-limit.service';

export const RATE_LIMIT_KEY = 'rate_limit';
export const RATE_LIMIT_STRATEGY_KEY = 'rate_limit_strategy';

export interface RateLimitMetadata {
  capacity: number;
  refillRate?: number; // for token bucket
  leakRate?: number; // for leaky bucket
  windowSeconds?: number;
  strategy?: 'token_bucket' | 'leaky_bucket';
}

@Injectable()
export class TokenBucketRateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Get rate limit metadata from decorator
    const rateLimitMeta =
      this.reflector.get<RateLimitMetadata>(RATE_LIMIT_KEY, handler) ||
      this.reflector.get<RateLimitMetadata>(RATE_LIMIT_KEY, controller);

    if (!rateLimitMeta) {
      // No custom rate limit configured, allow request
      return true;
    }

    // Get identifier (IP, user ID, API key, etc.)
    const identifier = this.getIdentifier(request);

    // Determine strategy
    const strategy = rateLimitMeta.strategy || 'token_bucket';
    const capacity = rateLimitMeta.capacity;
    const windowSeconds = rateLimitMeta.windowSeconds || 60;

    let result;

    if (strategy === 'token_bucket') {
      const refillRate = rateLimitMeta.refillRate || capacity / windowSeconds;
      result = await this.rateLimitService.checkTokenBucket(
        identifier,
        capacity,
        refillRate,
        windowSeconds,
      );
    } else {
      const leakRate = rateLimitMeta.leakRate || capacity / windowSeconds;
      result = await this.rateLimitService.checkLeakyBucket(
        identifier,
        capacity,
        leakRate,
        windowSeconds,
      );
    }

    if (!result.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetTime: new Date(result.resetTime).toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.header('X-RateLimit-Limit', capacity.toString());
    response.header('X-RateLimit-Remaining', result.remaining.toString());
    response.header(
      'X-RateLimit-Reset',
      new Date(result.resetTime).toISOString(),
    );

    return true;
  }

  protected getIdentifier(request: any): string {
    // Priority: API Key > User ID > IP Address
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) return `api_key:${apiKey}`;

    const userId = (request as any).user?.id;
    if (userId) return `user:${userId}`;

    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    return `ip:${ip}`;
  }
}
