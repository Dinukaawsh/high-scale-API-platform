import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/test-app.factory';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('info');
      expect(['ok', 'error']).toContain(body.status);

      if (body.info) {
        expect(body.info).toHaveProperty('database');
        expect(body.info).toHaveProperty('memory_heap');
        expect(body.info).toHaveProperty('memory_rss');
        expect(body.info).toHaveProperty('redis');
      }
    });

    it('should include database health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.info?.database) {
        expect(body.info.database).toHaveProperty('status');
      }
    });

    it('should include memory health checks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.info?.memory_heap) {
        expect(body.info.memory_heap).toHaveProperty('status');
      }

      if (body.info?.memory_rss) {
        expect(body.info.memory_rss).toHaveProperty('status');
      }
    });

    it('should include Redis health check', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      if (body.info?.redis) {
        expect(body.info.redis).toHaveProperty('status');
        expect(['up', 'down']).toContain(body.info.redis.status);
      }
    });
  });

  describe('GET /v1/health/metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/health/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeDefined();
      expect(typeof response.body).toBe('string');
      expect(response.body.length).toBeGreaterThan(0);

      // Check for Prometheus format
      expect(response.body).toContain('# HELP');
      expect(response.body).toContain('# TYPE');
    });

    it('should include HTTP request metrics', async () => {
      // Make a request to generate metrics
      await app.inject({
        method: 'GET',
        url: '/v1/health',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/health/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('http_requests_total');
    });
  });
});
