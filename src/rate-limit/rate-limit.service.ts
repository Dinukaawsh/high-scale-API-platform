import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../observability/metrics.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly skipIfRedisDown: boolean;

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.skipIfRedisDown = this.configService.get<boolean>(
      'RATE_LIMIT_SKIP_IF_REDIS_DOWN',
      true,
    );
  }

  /**
   * Token Bucket Algorithm Implementation
   * More flexible than leaky bucket - allows bursts up to bucket capacity
   */
  async checkTokenBucket(
    identifier: string,
    capacity: number,
    refillRate: number, // tokens per second
    windowSeconds: number = 60,
  ): Promise<RateLimitResult> {
    const key = `rate_limit:token_bucket:${identifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // If Redis is down and we're configured to skip, allow the request
    if (!this.redisService.isHealthy()) {
      if (this.skipIfRedisDown) {
        this.logger.warn(
          `Redis down, skipping rate limit for ${identifier} (skipIfRedisDown=true)`,
        );
        return {
          allowed: true,
          remaining: capacity,
          resetTime: now + windowMs,
        };
      }
      // If we don't skip, deny the request when Redis is down
      this.logger.error(
        `Redis down, denying request for ${identifier} (skipIfRedisDown=false)`,
      );
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowMs,
        retryAfter: windowSeconds,
      };
    }

    try {
      const redis = this.redisService.getClient();
      const luaScript = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refillRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local windowMs = tonumber(ARGV[4])

        local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
        local tokens = tonumber(bucket[1]) or capacity
        local lastRefill = tonumber(bucket[2]) or now

        -- Calculate tokens to add based on time passed
        local timePassed = (now - lastRefill) / 1000 -- convert to seconds
        local tokensToAdd = math.floor(timePassed * refillRate)
        tokens = math.min(capacity, tokens + tokensToAdd)

        -- Check if we can consume a token
        if tokens >= 1 then
          tokens = tokens - 1
          redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
          redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
          return {1, tokens, now + windowMs}
        else
          -- Calculate retry after
          local tokensNeeded = 1 - tokens
          local timeNeeded = math.ceil(tokensNeeded / refillRate)
          return {0, tokens, now + (timeNeeded * 1000), timeNeeded}
        end
      `;

      const result = (await redis.eval(
        luaScript,
        1,
        key,
        capacity.toString(),
        refillRate.toString(),
        now.toString(),
        windowMs.toString(),
      )) as [number, number, number, number?];

      const [allowed, remaining, resetTime, retryAfter] = result;

      if (!allowed) {
        this.metricsService.recordRateLimitHit(identifier, 'token_bucket');
      }

      return {
        allowed: allowed === 1,
        remaining: Math.floor(remaining),
        resetTime,
        retryAfter: retryAfter ? Math.ceil(retryAfter) : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Rate limit check failed for ${identifier}: ${error.message}`,
      );

      // Fail open if configured
      if (this.skipIfRedisDown) {
        return {
          allowed: true,
          remaining: capacity,
          resetTime: now + windowMs,
        };
      }

      // Fail closed
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowMs,
        retryAfter: windowSeconds,
      };
    }
  }

  /**
   * Leaky Bucket Algorithm Implementation
   * More predictable rate - smooths out bursts
   */
  async checkLeakyBucket(
    identifier: string,
    capacity: number,
    leakRate: number, // requests per second
    windowSeconds: number = 60,
  ): Promise<RateLimitResult> {
    const key = `rate_limit:leaky_bucket:${identifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    if (!this.redisService.isHealthy()) {
      if (this.skipIfRedisDown) {
        return {
          allowed: true,
          remaining: capacity,
          resetTime: now + windowMs,
        };
      }
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowMs,
        retryAfter: windowSeconds,
      };
    }

    try {
      const redis = this.redisService.getClient();
      const luaScript = `
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local leakRate = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        local windowMs = tonumber(ARGV[4])

        local bucket = redis.call('HMGET', key, 'level', 'lastLeak')
        local level = tonumber(bucket[1]) or 0
        local lastLeak = tonumber(bucket[2]) or now

        -- Calculate how much has leaked since last check
        local timePassed = (now - lastLeak) / 1000
        local leaked = math.floor(timePassed * leakRate)
        level = math.max(0, level - leaked)

        -- Check if we can add a request
        if level < capacity then
          level = level + 1
          redis.call('HMSET', key, 'level', level, 'lastLeak', now)
          redis.call('EXPIRE', key, math.ceil(windowMs / 1000))
          return {1, capacity - level, now + windowMs}
        else
          -- Calculate when bucket will have space
          local spaceNeeded = level - capacity + 1
          local timeNeeded = math.ceil(spaceNeeded / leakRate)
          return {0, 0, now + (timeNeeded * 1000), timeNeeded}
        end
      `;

      const result = (await redis.eval(
        luaScript,
        1,
        key,
        capacity.toString(),
        leakRate.toString(),
        now.toString(),
        windowMs.toString(),
      )) as [number, number, number, number?];

      const [allowed, remaining, resetTime, retryAfter] = result;

      if (!allowed) {
        this.metricsService.recordRateLimitHit(identifier, 'leaky_bucket');
      }

      return {
        allowed: allowed === 1,
        remaining: Math.floor(remaining),
        resetTime,
        retryAfter: retryAfter ? Math.ceil(retryAfter) : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Leaky bucket check failed for ${identifier}: ${error.message}`,
      );

      if (this.skipIfRedisDown) {
        return {
          allowed: true,
          remaining: capacity,
          resetTime: now + windowMs,
        };
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowMs,
        retryAfter: windowSeconds,
      };
    }
  }
}
