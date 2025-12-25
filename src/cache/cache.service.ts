import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../observability/metrics.service';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  namespace?: string; // Cache namespace
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTtl = this.configService.get<number>('REDIS_TTL', 3600);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const cacheKey = this.buildKey(key);

    if (!this.redisService.isHealthy()) {
      this.logger.warn(`Redis down, cache miss for key: ${cacheKey}`);
      this.metricsService.recordCacheMiss(key);
      return null;
    }

    try {
      const value = await this.redisService.get(cacheKey);

      if (value === null) {
        this.metricsService.recordCacheMiss(key);
        return null;
      }

      this.metricsService.recordCacheHit(key);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        `Cache get failed for key ${cacheKey}: ${error.message}`,
      );
      this.metricsService.recordCacheMiss(key);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<boolean> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const ttl = options?.ttl || this.defaultTtl;

    if (!this.redisService.isHealthy()) {
      this.logger.warn(`Redis down, skipping cache set for key: ${cacheKey}`);
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      const success = await this.redisService.set(cacheKey, serialized, ttl);

      // Store cache tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.storeCacheTags(cacheKey, options.tags);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Cache set failed for key ${cacheKey}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Delete a specific cache key
   */
  async delete(key: string, namespace?: string): Promise<boolean> {
    const cacheKey = this.buildKey(key, namespace);

    if (!this.redisService.isHealthy()) {
      return false;
    }

    try {
      await this.redisService.del(cacheKey);
      await this.deleteCacheTags(cacheKey);
      return true;
    } catch (error) {
      this.logger.error(
        `Cache delete failed for key ${cacheKey}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    if (!this.redisService.isHealthy()) {
      return 0;
    }

    let invalidatedCount = 0;

    try {
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        const keys = await this.redisService.getClient().smembers(tagKey);

        for (const key of keys) {
          await this.redisService.del(key);
          invalidatedCount++;
        }

        await this.redisService.del(tagKey);
      }
    } catch (error) {
      this.logger.error(`Cache invalidation by tags failed: ${error.message}`);
    }

    return invalidatedCount;
  }

  /**
   * Clear all cache (use with caution)
   */
  async clear(namespace?: string): Promise<boolean> {
    if (!this.redisService.isHealthy()) {
      return false;
    }

    try {
      const pattern = namespace ? `cache:${namespace}:*` : 'cache:*';

      const keys = await this.redisService.getClient().keys(pattern);

      if (keys.length > 0) {
        await this.redisService.getClient().del(...keys);
      }

      return true;
    } catch (error) {
      this.logger.error(`Cache clear failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);

    return value;
  }

  private buildKey(key: string, namespace?: string): string {
    const prefix = namespace ? `cache:${namespace}:${key}` : `cache:${key}`;
    return prefix;
  }

  private async storeCacheTags(
    cacheKey: string,
    tags: string[],
  ): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `cache:tag:${tag}`;
        await this.redisService.getClient().sadd(tagKey, cacheKey);
        await this.redisService.expire(tagKey, this.defaultTtl);
      }
    } catch (error) {
      this.logger.warn(`Failed to store cache tags: ${error.message}`);
    }
  }

  private async deleteCacheTags(cacheKey: string): Promise<void> {
    try {
      // Find all tags that reference this key
      const tagPattern = 'cache:tag:*';
      const tagKeys = await this.redisService.getClient().keys(tagPattern);

      for (const tagKey of tagKeys) {
        await this.redisService.getClient().srem(tagKey, cacheKey);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete cache tags: ${error.message}`);
    }
  }
}
