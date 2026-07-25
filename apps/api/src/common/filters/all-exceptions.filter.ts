import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';

interface ErrorBody {
  statusCode: number;
  message: string;
  path: string;
  timestamp: string;
  /** Field-level issues, present only for validation failures. */
  errors?: { path: string; message: string }[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Never leak internals of an unhandled error to the client.
    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    // Validation issues describe the caller's own payload, so surfacing them
    // leaks nothing — and without them a 400 is unactionable for the client.
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      body.errors = zodError.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
    }

    response.status(status).json(body);
  }
}
