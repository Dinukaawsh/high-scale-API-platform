import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IdempotencyService } from '../idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Only apply to POST, PUT, PATCH, DELETE
    const method = request.method.toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['idempotency-key'] as string;
    if (!idempotencyKey) {
      return next.handle();
    }

    // Generate request hash
    const requestHash = await this.idempotencyService.hashRequest(request.body);

    // Generate full key
    const identifier = this.getIdentifier(request);
    const fullKey = this.idempotencyService.generateKey(
      method,
      request.url,
      identifier,
      idempotencyKey,
    );

    // Check if request is duplicate
    const checkResult = await this.idempotencyService.checkIdempotency(
      fullKey,
      requestHash,
    );

    if (checkResult.isDuplicate && checkResult.cachedResponse) {
      // Return cached response
      response.header('X-Idempotency-Key', idempotencyKey);
      response.header('X-Idempotency-Cached', 'true');
      return of(checkResult.cachedResponse);
    }

    // Process request and cache response
    return next.handle().pipe(
      tap(async (data) => {
        await this.idempotencyService.storeIdempotency(
          fullKey,
          data,
          requestHash,
        );
        response.header('X-Idempotency-Key', idempotencyKey);
        response.header('X-Idempotency-Cached', 'false');
      }),
    );
  }

  private getIdentifier(request: any): string {
    const apiKey = request.headers['x-api-key'] as string;
    if (apiKey) return `api_key:${apiKey}`;

    const userId = request.user?.id;
    if (userId) return `user:${userId}`;

    return `ip:${request.ip || 'unknown'}`;
  }
}
