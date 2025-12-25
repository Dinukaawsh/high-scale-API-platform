import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CacheService } from './cache.service';

export enum CacheInvalidationStrategy {
  WRITE_THROUGH = 'write_through',
  WRITE_BEHIND = 'write_behind',
  TTL_BASED = 'ttl_based',
  EVENT_BASED = 'event_based',
}

@Injectable()
export class CacheInvalidationService implements OnModuleInit {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(private readonly cacheService: CacheService) {}

  onModuleInit() {
    // Cache invalidation can be triggered via events or direct calls
    // Example: Use EventEmitter2 in your domain services to emit events
  }

  /**
   * Invalidate cache when data is updated (Write-Through pattern)
   */
  async invalidateOnUpdate(keys: string[], tags?: string[]): Promise<void> {
    // Invalidate specific keys
    for (const key of keys) {
      await this.cacheService.delete(key);
    }

    // Invalidate by tags
    if (tags && tags.length > 0) {
      await this.cacheService.invalidateByTags(tags);
    }

    this.logger.debug(`Invalidated cache for keys: ${keys.join(', ')}`);
  }

  /**
   * Invalidate user-specific cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheService.invalidateByTags([`user:${userId}`]);
    this.logger.debug(`Invalidated cache for user: ${userId}`);
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const count = await this.cacheService.invalidateByTags(tags);
    this.logger.debug(
      `Invalidated ${count} cache entries for tags: ${tags.join(', ')}`,
    );
  }

  /**
   * Pattern-based invalidation (e.g., all product caches)
   */
  async invalidatePattern(pattern: string): Promise<void> {
    await this.cacheService.clear(pattern);
    this.logger.debug(`Invalidated cache pattern: ${pattern}`);
  }
}
