import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { Observable, tap } from "rxjs";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap(() => {
        const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        this.logger.log(`${method} ${url} ${ms.toFixed(1)}ms`);
      }),
    );
  }
}
