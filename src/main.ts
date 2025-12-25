import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingService } from './observability/logging.service';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { IdempotencyInterceptor } from './idempotency/interceptors/idempotency.interceptor';
import { MetricsService } from './observability/metrics.service';
import { IdempotencyService } from './idempotency/idempotency.service';

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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const helmet = require('@fastify/helmet');
  await app.register(helmet, {
    contentSecurityPolicy: false, // Adjust based on your needs
  });

  // Enable CORS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const cors = require('@fastify/cors');
  await app.register(cors, {
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1', // Use numeric version for @Version() decorator
    prefix: 'v', // Add 'v' prefix to version numbers (results in /v1/, /v2/, etc.)
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
  const metricsService = app.get<MetricsService>('MetricsService');
  const idempotencyService = app.get<IdempotencyService>('IdempotencyService');

  app.useGlobalInterceptors(
    new LoggingInterceptor(metricsService),
    new IdempotencyInterceptor(idempotencyService),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger/OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('High-Scale API Platform')
    .setDescription(
      'Production-ready API platform with authentication, rate limiting, caching, and observability',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API Key for authentication',
      },
      'api-key',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('health', 'Health check and monitoring')
    .addTag('api', 'API endpoints')
    .addServer(
      `http://localhost:${configService.get<number>('PORT', 3000)}`,
      'Local development',
    )
    .build();

  const document = SwaggerModule.createDocument(app as any, swaggerConfig);
  SwaggerModule.setup('api/docs', app as any, document, {
    customSiteTitle: 'API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  loggingService.log(
    `Application is running on: http://localhost:${port}`,
    'Bootstrap',
  );
  loggingService.log(
    `API Documentation: http://localhost:${port}/api/docs`,
    'Bootstrap',
  );
  loggingService.log(
    `Environment: ${configService.get<string>('NODE_ENV')}`,
    'Bootstrap',
  );
}
void bootstrap();
