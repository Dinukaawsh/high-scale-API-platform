import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Track connection state changes
    this.redis.on('connect', () => {
      this.logger.log('Redis connecting...');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.log('Redis connected and ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
      // Don't set isConnected to false on error - may be transient
      // Only set to false on close
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed, operating in degraded mode');
    });

    this.redis.on('reconnecting', (delay: number) => {
      this.logger.warn(`Redis reconnecting in ${delay}ms...`);
    });

    this.redis.on('end', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection ended');
    });
  }

  async onModuleInit() {
    try {
      // If lazyConnect is true, connection happens on first command
      // Otherwise, explicitly connect
      if (!this.redis.status || this.redis.status === 'end') {
        await this.redis.connect();
      }
      // Check if already connected
      if (this.redis.status === 'ready') {
        this.isConnected = true;
        this.logger.log('Redis service initialized');
      } else {
        this.logger.log('Redis service initialized (lazy connect)');
      }
    } catch (error) {
      this.logger.warn(
        `Redis connection failed, operating in degraded mode: ${error.message}`,
      );
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Redis get failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value);
      } else {
        await this.redis.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.warn(`Redis set failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      this.logger.warn(`Redis del failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.warn(`Redis exists failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  async incr(key: string): Promise<number | null> {
    if (!this.isConnected) return null;
    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.logger.warn(`Redis incr failed for key ${key}: ${error.message}`);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.warn(`Redis expire failed for key ${key}: ${error.message}`);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    // Always attempt ping to check actual connection state
    // This helps detect reconnection
    try {
      const result = await this.redis.ping();
      const wasConnected = this.isConnected;
      this.isConnected = result === 'PONG';

      // Log state change
      if (!wasConnected && this.isConnected) {
        this.logger.log('Redis reconnected successfully');
      }

      return this.isConnected;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  getClient(): Redis {
    return this.redis;
  }
}
