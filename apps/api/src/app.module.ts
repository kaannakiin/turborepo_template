import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { validateEnv } from './config/env.schema';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // The repo-root .env is shared with the Prisma CLI
      // (packages/database/prisma.config.ts) so DATABASE_URL is declared once.
      envFilePath: ['../../.env'],
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
  ],
  providers: [
    // Cross-cutting concerns are registered once, here. Registering them in
    // each feature module would create a separate instance per module.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
