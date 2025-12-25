import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { LoggingService } from './observability/logging.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { IdempotencyInterceptor } from './idempotency/interceptors/idempotency.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // We use our custom logger
      trustProxy: true, // For rate limiting behind proxy
    }),
  );

  const configService = app.get(ConfigService);
  const loggingService = app.get(LoggingService);

  // Security headers - Fastify helmet plugin
  await app.register(require('@fastify/helmet'), {
    contentSecurityPolicy: false, // Adjust based on your needs
  });

  // Enable CORS
  await app.register(require('@fastify/cors'), {
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: configService.get<string>('API_VERSION', 'v1'),
    prefix: false, // Don't add 'v' prefix automatically
  });

  // Global validation pipe
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

  // Global interceptors
  const metricsService = app.get('MetricsService');
  const idempotencyService = app.get('IdempotencyService');

  app.useGlobalInterceptors(
    new LoggingInterceptor(metricsService),
    new IdempotencyInterceptor(idempotencyService),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  loggingService.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  loggingService.log(
    `Environment: ${configService.get<string>('NODE_ENV')}`,
    'Bootstrap',
  );
}
bootstrap();
