import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/test-app.factory';

describe('App (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/', () => {
    it('should return hello message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('message');
    });
  });

  describe('API Versioning', () => {
    it('should require v1 prefix', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      // Should return 404 or redirect to v1
      expect([404, 301, 302]).toContain(response.statusCode);
    });
  });
});
