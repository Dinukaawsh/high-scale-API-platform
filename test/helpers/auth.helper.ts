import { NestFastifyApplication } from '@nestjs/platform-fastify';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(
  app: NestFastifyApplication,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: {
      email,
      password,
    },
  });

  if (response.statusCode !== 201) {
    throw new Error(
      `Registration failed: ${response.statusCode} - ${response.body}`,
    );
  }

  return JSON.parse(response.body);
}

export async function loginUser(
  app: NestFastifyApplication,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: {
      email,
      password,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed: ${response.statusCode} - ${response.body}`);
  }

  return JSON.parse(response.body);
}

export async function refreshToken(
  app: NestFastifyApplication,
  refreshToken: string,
): Promise<AuthTokens> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/refresh',
    payload: {
      refreshToken,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Token refresh failed: ${response.statusCode} - ${response.body}`,
    );
  }

  return JSON.parse(response.body);
}

export async function logoutUser(
  app: NestFastifyApplication,
  accessToken: string,
): Promise<void> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/logout',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(`Logout failed: ${response.statusCode} - ${response.body}`);
  }
}
