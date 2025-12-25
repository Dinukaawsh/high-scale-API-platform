import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
  cachedResponse?: T;
  key: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly ttl: number = 86400; // 24 hours default

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.ttl = this.configService.get<number>('IDEMPOTENCY_TTL', 86400);
  }

  /**
   * Check if request is idempotent and return cached response if exists
   */
  async checkIdempotency<T>(
    key: string,
    requestHash?: string,
  ): Promise<IdempotencyResult<T>> {
    const idempotencyKey = `idempotency:${key}`;

    if (!this.redisService.isHealthy()) {
      this.logger.warn('Redis down, cannot check idempotency - allowing request');
      return { isDuplicate: false, key: idempotencyKey };
    }

    try {
      const cached = await this.redisService.get(idempotencyKey);

      if (cached) {
        const parsed = JSON.parse(cached);

        // If request hash provided, verify it matches
        if (requestHash && parsed.requestHash !== requestHash) {
          this.logger.warn(
            `Idempotency key conflict for ${key} - different request content`,
          );
          return { isDuplicate: false, key: idempotencyKey };
        }

        return {
          isDuplicate: true,
          cachedResponse: parsed.response,
          key: idempotencyKey,
        };
      }

      return { isDuplicate: false, key: idempotencyKey };
    } catch (error) {
      this.logger.error(`Idempotency check failed for ${key}: ${error.message}`);
      return { isDuplicate: false, key: idempotencyKey };
    }
  }

  /**
   * Store idempotency key with response
   */
  async storeIdempotency<T>(
    key: string,
    response: T,
    requestHash?: string,
  ): Promise<void> {
    const idempotencyKey = `idempotency:${key}`;

    if (!this.redisService.isHealthy()) {
      this.logger.warn('Redis down, cannot store idempotency');
      return;
    }

    try {
      const data = {
        response,
        requestHash,
        timestamp: Date.now(),
      };

      await this.redisService.set(
        idempotencyKey,
        JSON.stringify(data),
        this.ttl,
      );
    } catch (error) {
      this.logger.error(`Failed to store idempotency for ${key}: ${error.message}`);
    }
  }

  /**
   * Generate idempotency key from request
   */
  generateKey(
    method: string,
    path: string,
    identifier: string,
    bodyHash?: string,
  ): string {
    const parts = [method, path, identifier];
    if (bodyHash) {
      parts.push(bodyHash);
    }
    return parts.join(':');
  }

  /**
   * Generate hash from request body
   */
  async hashRequest(body: any): Promise<string> {
    const crypto = await import('crypto');
    const bodyString = JSON.stringify(body || {});
    return crypto.createHash('sha256').update(bodyString).digest('hex');
  }
}

