import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { type TranslateFn } from "@repo/i18n/instance";
import { isTranslationKey, translateZodIssues } from "@repo/i18n/zod";
import type { Request, Response } from "express";
import { ZodValidationException } from "nestjs-zod";
import type { ZodError } from "zod";
import { I18nService } from "../../i18n/i18n.service";

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  errors?: { path: string; code: string; message: string }[];
}

interface ResolvedError {
  code: string;
  message: string;
  errors?: ErrorBody["errors"];
}

const STATUS_FALLBACK_KEY: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "errors.http.badRequest",
  [HttpStatus.UNAUTHORIZED]: "errors.http.unauthorized",
  [HttpStatus.FORBIDDEN]: "errors.http.forbidden",
  [HttpStatus.NOT_FOUND]: "errors.http.notFound",
  [HttpStatus.CONFLICT]: "errors.http.conflict",
  [HttpStatus.TOO_MANY_REQUESTS]: "errors.http.tooManyRequests",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "errors.http.internal",
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const t = this.i18n.translatorFor(request.locale);

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const resolved = resolve(exception, status, t);

    const body: ErrorBody = {
      statusCode: status,
      code: resolved.code,
      message: resolved.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    if (resolved.errors) body.errors = resolved.errors;

    response.status(status).json(body);
  }
}

function resolve(
  exception: unknown,
  status: number,
  t: TranslateFn,
): ResolvedError {
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError() as ZodError;
    return {
      code: "errors.validation.failed",
      message: t("errors.validation.failed"),
      errors: translateZodIssues(zodError.issues, t),
    };
  }

  if (exception instanceof HttpException) {
    const res = exception.getResponse();
    if (typeof res === "object" && res !== null && "code" in res) {
      const { code, params } = res as {
        code: unknown;
        params?: Record<string, unknown>;
      };
      if (typeof code === "string" && isTranslationKey(code)) {
        return { code, message: t(code, params) };
      }
    }
  }

  const fallback = STATUS_FALLBACK_KEY[status] ?? "errors.http.generic";
  return { code: fallback, message: t(fallback) };
}
