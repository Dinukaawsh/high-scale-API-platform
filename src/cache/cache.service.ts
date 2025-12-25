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
   * Get or set pattern (cache-aside) with stampede protection
   * Uses distributed locking to prevent multiple concurrent requests
   * from hitting the database for the same key
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cacheKey = this.buildKey(key, options?.namespace);
    const lockKey = `${cacheKey}:lock`;
    const lockTtl = 30; // Lock expires after 30 seconds

    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If Redis is down, just call factory (no stampede protection)
    if (!this.redisService.isHealthy()) {
      this.logger.warn(
        `Redis down, calling factory without stampede protection for key: ${cacheKey}`,
      );
      const value = await factory();
      await this.set(key, value, options);
      return value;
    }

    // Try to acquire lock
    const lockAcquired = await this.acquireLock(lockKey, lockTtl);

    if (lockAcquired) {
      // We got the lock, fetch the data
      try {
        // Double-check cache (another process might have set it)
        const doubleCheck = await this.get<T>(key);
        if (doubleCheck !== null) {
          await this.releaseLock(lockKey);
          return doubleCheck;
        }

        // Fetch from factory
        const value = await factory();
        await this.set(key, value, options);
        await this.releaseLock(lockKey);
        return value;
      } catch (error) {
        // Release lock on error
        await this.releaseLock(lockKey);
        throw error;
      }
    } else {
      // Lock is held by another process, wait and retry
      const maxWaitTime = 5000; // 5 seconds max wait
      const checkInterval = 100; // Check every 100ms
      const maxRetries = maxWaitTime / checkInterval;

      for (let i = 0; i < maxRetries; i++) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));

        const cached = await this.get<T>(key);
        if (cached !== null) {
          return cached;
        }

        // Check if lock is still held
        const lockExists = await this.redisService.exists(lockKey);
        if (!lockExists) {
          // Lock expired, try to get value one more time
          const cached = await this.get<T>(key);
          if (cached !== null) {
            return cached;
          }
          // If still not cached, fall through to factory call
          break;
        }
      }

      // If we've waited too long, just call factory
      // This prevents indefinite waiting
      this.logger.warn(
        `Lock wait timeout for key ${cacheKey}, calling factory directly`,
      );
      const value = await factory();
      await this.set(key, value, options);
      return value;
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX
   */
  private async acquireLock(lockKey: string, ttl: number): Promise<boolean> {
    if (!this.redisService.isHealthy()) {
      return false;
    }

    try {
      const redis = this.redisService.getClient();
      // SET key value NX EX ttl - atomic operation
      const result = await redis.set(lockKey, '1', 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(`Failed to acquire lock ${lockKey}: ${error.message}`);
      return false;
    }
  }

  /**
   * Release a distributed lock
   */
  private async releaseLock(lockKey: string): Promise<void> {
    if (!this.redisService.isHealthy()) {
      return;
    }

    try {
      await this.redisService.del(lockKey);
    } catch (error) {
      this.logger.warn(`Failed to release lock ${lockKey}: ${error.message}`);
    }
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
