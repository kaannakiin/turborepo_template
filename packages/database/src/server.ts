import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

/**
 * Server-only surface. Reachable as `@repo/database/server`; the package's
 * `exports` map swaps this for a throwing stub under the `browser` condition.
 *
 * The driver adapter is constructed here so no consumer has to depend on
 * `@prisma/adapter-pg` or `pg` directly.
 */
export function prismaClientOptions(connectionString: string) {
  return { adapter: new PrismaPg({ connectionString }) };
}

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient(prismaClientOptions(connectionString));
}

// Re-exported as a value, not just a type: NestJS needs the class itself to
// `extends PrismaClient` and to use it as an injection token. It also keeps
// TS2742 ("inferred type cannot be named without a reference to...") away from
// consumers that infer a client instance.
export { PrismaClient } from "./generated/prisma/client";
export type { Prisma } from "./generated/prisma/client";
