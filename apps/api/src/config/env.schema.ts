import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated list of allowed origins for CORS.
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  // Same value the Prisma CLI reads from the repo-root .env — one URL, one
  // source. No default: an unset database is a startup failure, not a fallback.
  DATABASE_URL: z.url(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Fail fast at bootstrap instead of at the first request that reads a
 * missing variable. Wired into ConfigModule via `validate`.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return result.data;
}
