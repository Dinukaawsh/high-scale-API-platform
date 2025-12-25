import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { IdempotencyInterceptor } from '../../src/idempotency/interceptors/idempotency.interceptor';
import { MetricsService } from '../../src/observability/metrics.service';
import { IdempotencyService } from '../../src/idempotency/idempotency.service';

export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({
      logger: false,
    }),
  );

  // Apply same configuration as main.ts
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helmet = require('@fastify/helmet');
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cors = require('@fastify/cors');
  await app.register(cors, {
    origin: '*',
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // Use numeric version for @Version() decorator
    prefix: 'v', // Add 'v' prefix to version numbers (results in /v1/, /v2/, etc.)
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors (same as main.ts)
  const metricsService = app.get<MetricsService>('MetricsService');
  const idempotencyService = app.get<IdempotencyService>('IdempotencyService');

  app.useGlobalInterceptors(
    new LoggingInterceptor(metricsService),
    new IdempotencyInterceptor(idempotencyService),
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  // Ensure proper cleanup on process exit
  process.on('SIGTERM', async () => {
    await app.close();
  });
  process.on('SIGINT', async () => {
    await app.close();
  });

  return app;
}
