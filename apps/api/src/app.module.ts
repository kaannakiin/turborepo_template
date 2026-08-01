import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ZodValidationPipe } from "nestjs-zod";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { validateEnv } from "./config/env.schema";
import { AccessModule } from "./control-plane/access/access.module";
import { IdentityModule } from "./control-plane/identity/identity.module";
import { PlatformModule } from "./control-plane/platform/platform.module";
import { TenancyModule } from "./control-plane/tenancy/tenancy.module";
import { VerificationModule } from "./control-plane/verification/verification.module";
import { HealthModule } from "./health/health.module";
import { I18nModule } from "./i18n/i18n.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      envFilePath: ["../../.env"],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
      // The e2e suites drive login/register far past production limits by
      // design; the dedicated throttling spec re-enables via THROTTLE_E2E.
      skipIf: () =>
        process.env.NODE_ENV === "test" && process.env.THROTTLE_E2E !== "1",
    }),
    I18nModule,
    PrismaModule,
    IdentityModule,
    VerificationModule,
    TenancyModule,
    AccessModule,
    HealthModule,
    PlatformModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // Registration order is execution order: throttle abusive traffic before
    // authenticating, authenticate before authorizing.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
