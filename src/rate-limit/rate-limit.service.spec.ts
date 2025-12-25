import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../observability/metrics.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redisService: jest.Mocked<RedisService>;
  let metricsService: jest.Mocked<MetricsService>;
  let configService: jest.Mocked<ConfigService>;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      eval: jest.fn(),
    };

    // Create mock config service BEFORE creating the module
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          RATE_LIMIT_SKIP_IF_REDIS_DOWN: true,
        };
        if (key === 'RATE_LIMIT_SKIP_IF_REDIS_DOWN') {
          return config[key] ?? defaultValue ?? true;
        }
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        {
          provide: RedisService,
          useValue: {
            isHealthy: jest.fn(),
            getClient: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordRateLimitHit: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
    redisService = module.get(RedisService);
    metricsService = module.get(MetricsService);
    configService = module.get(ConfigService);

    redisService.getClient.mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkTokenBucket', () => {
    it('should allow request when Redis is healthy and tokens available', async () => {
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockResolvedValue([1, 10, Date.now() + 60000]);

      const result = await service.checkTokenBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(mockRedisClient.eval).toHaveBeenCalled();
    });

    it('should deny request when tokens exhausted', async () => {
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockResolvedValue([0, 0, Date.now() + 60000, 10]);

      const result = await service.checkTokenBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(metricsService.recordRateLimitHit).toHaveBeenCalled();
    });

    it('should allow request when Redis is down and skipIfRedisDown is true', async () => {
      redisService.isHealthy.mockReturnValue(false);

      const result = await service.checkTokenBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true);
      expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });

    it('should deny request when Redis is down and skipIfRedisDown is false', async () => {
      // Create a new service instance with skipIfRedisDown = false
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'RATE_LIMIT_SKIP_IF_REDIS_DOWN') return false;
          return defaultValue;
        },
      );
      const newService = new RateLimitService(
        redisService,
        metricsService,
        configService,
      );
      redisService.isHealthy.mockReturnValue(false);

      const result = await newService.checkTokenBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
    });

    it('should handle Redis errors gracefully', async () => {
      // Reset mock to return true for skipIfRedisDown
      configService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === 'RATE_LIMIT_SKIP_IF_REDIS_DOWN') return true;
          return defaultValue;
        },
      );
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

      const result = await service.checkTokenBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true); // Fail open by default
    });
  });

  describe('checkLeakyBucket', () => {
    it('should allow request when bucket has capacity', async () => {
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockResolvedValue([1, 5, Date.now() + 60000]);

      const result = await service.checkLeakyBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should deny request when bucket is full', async () => {
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockResolvedValue([0, 0, Date.now() + 60000, 5]);

      const result = await service.checkLeakyBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(metricsService.recordRateLimitHit).toHaveBeenCalled();
    });

    it('should allow request when Redis is down and skipIfRedisDown is true', async () => {
      redisService.isHealthy.mockReturnValue(false);

      const result = await service.checkLeakyBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      redisService.isHealthy.mockReturnValue(true);
      mockRedisClient.eval.mockRejectedValue(new Error('Redis error'));

      const result = await service.checkLeakyBucket('user1', 10, 1, 60);

      expect(result.allowed).toBe(true); // Fail open by default
    });
  });
});
