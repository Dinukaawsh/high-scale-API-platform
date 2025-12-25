import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from '../../observability/metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode || 200;
          const duration = (Date.now() - startTime) / 1000;

          // Log request
          this.logger.log(
            `${method} ${url} ${statusCode} ${duration.toFixed(3)}ms`,
          );

          // Record metrics
          this.metricsService.recordHttpRequest(
            method,
            url,
            statusCode,
            duration,
          );
        },
        error: (error) => {
          const duration = (Date.now() - startTime) / 1000;
          const statusCode = error.status || 500;

          this.logger.error(
            `${method} ${url} ${statusCode} ${duration.toFixed(3)}ms - ${error.message}`,
          );

          this.metricsService.recordHttpError(
            method,
            url,
            error.constructor.name,
          );
        },
      }),
    );
  }
}
