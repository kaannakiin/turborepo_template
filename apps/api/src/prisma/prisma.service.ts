import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, prismaClientOptions } from '@repo/database/server';
import type { Env } from '../config/env.schema';

/**
 * `@repo/database/server` is the ONLY Prisma entry point this app may import.
 * It owns the driver adapter (`@prisma/adapter-pg`) so the connection details
 * stay in one place — see packages/database/README.md for the full rule.
 *
 * Extending PrismaClient makes every model delegate available on the injected
 * service (`this.prisma.user.findMany()`), which is why the class is exported
 * as a value from the database package and not just as a type.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService<Env, true>) {
    super(prismaClientOptions(config.getOrThrow('DATABASE_URL')));
  }

  async onModuleDestroy(): Promise<void> {
    // `app.enableShutdownHooks()` in main.ts is what makes this fire on
    // SIGTERM — without it the pool would be left open on `turbo dev` restarts.
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
