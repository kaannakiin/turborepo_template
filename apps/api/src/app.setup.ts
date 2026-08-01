import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseAcceptLanguage } from "@repo/i18n/locale";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import type { Env } from "./config/env.schema";

/**
 * Everything main.ts would otherwise wire imperatively lives here so e2e tests
 * can call the exact same function — a test app must never drift from the
 * production middleware stack.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.use(cookieParser());

  app.use((req: Request, _res: Response, next: NextFunction): void => {
    req.locale = parseAcceptLanguage(req.headers["accept-language"]);
    next();
  });

  app.enableCors({
    origin: config
      .get("CORS_ORIGINS", { infer: true })
      .split(",")
      .map((o) => o.trim()),
    credentials: true,
  });
}
