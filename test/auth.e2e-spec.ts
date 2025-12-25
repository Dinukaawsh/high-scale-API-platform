import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createTestApp } from './helpers/test-app.factory';
import {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
} from './helpers/auth.helper';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const email = `test-${Date.now()}@example.com`;
      const password = 'TestPassword123!';

      const result = await registerUser(app, email, password);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.refreshToken.length).toBeGreaterThan(0);
    });

    it('should reject registration with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject registration with short password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'short',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject duplicate email registration', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      const password = 'TestPassword123!';

      // First registration should succeed
      await registerUser(app, email, password);

      // Second registration with same email should fail
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          email,
          password,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /v1/auth/login', () => {
    const testEmail = `login-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';

    beforeAll(async () => {
      // Create a user for login tests
      await registerUser(app, testEmail, testPassword);
    });

    it('should login with valid credentials', async () => {
      const result = await loginUser(app, testEmail, testPassword);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
    });

    it('should reject login with invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject login with invalid password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: {
          email: testEmail,
          password: 'WrongPassword123!',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    let refreshTokenValue: string;

    beforeAll(async () => {
      const email = `refresh-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      const tokens = await registerUser(app, email, password);
      refreshTokenValue = tokens.refreshToken;
    });

    it('should refresh access token successfully', async () => {
      const result = await refreshToken(app, refreshTokenValue);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresIn');
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
    });

    it('should reject invalid refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: {
          refreshToken: 'invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject empty refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        payload: {
          refreshToken: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      const email = `logout-${Date.now()}@example.com`;
      const password = 'TestPassword123!';
      const tokens = await registerUser(app, email, password);
      accessToken = tokens.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      await expect(logoutUser(app, accessToken)).resolves.not.toThrow();
    });

    it('should reject logout without token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject logout with invalid token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Complete Auth Flow', () => {
    it('should complete full authentication flow', async () => {
      const email = `flow-${Date.now()}@example.com`;
      const password = 'TestPassword123!';

      // 1. Register
      const registerResult = await registerUser(app, email, password);
      expect(registerResult.accessToken).toBeDefined();

      // 2. Login
      const loginResult = await loginUser(app, email, password);
      expect(loginResult.accessToken).toBeDefined();

      // 3. Refresh token
      const refreshResult = await refreshToken(app, loginResult.refreshToken);
      expect(refreshResult.accessToken).toBeDefined();

      // 4. Logout
      await expect(
        logoutUser(app, refreshResult.accessToken),
      ).resolves.not.toThrow();
    });
  });
});
