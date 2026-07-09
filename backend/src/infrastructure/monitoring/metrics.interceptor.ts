import { HttpException, Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { tap } from 'rxjs';
import type { Observable } from 'rxjs';

import { MetricsService } from './metrics.service';

/**
 * Feeds HTTP request/error/latency counters into {@link MetricsService} for the
 * `/metrics` endpoint. Records the real status on both the success and error
 * paths (deriving the status from the thrown `HttpException`, or 500), so error
 * metrics are accurate even though the exception filter sets the response later.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const start = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method;

    return next.handle().pipe(
      tap({
        next: () => this.metrics.record(method, response.statusCode, Date.now() - start),
        error: (err: unknown) =>
          this.metrics.record(method, this.statusFromError(err), Date.now() - start),
      }),
    );
  }

  private statusFromError(err: unknown): number {
    return err instanceof HttpException ? err.getStatus() : 500;
  }
}
