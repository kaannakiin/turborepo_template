import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global so feature modules inject PrismaService without re-importing this
 * module. One connection pool per process — importing it per-feature would
 * still share the instance, but the boilerplate buys nothing.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
