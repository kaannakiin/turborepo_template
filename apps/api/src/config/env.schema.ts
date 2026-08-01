import { z } from "zod";

const ttlSchema = z.string().regex(/^\d+[smhd]$/);

export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  // Comma-separated list of allowed origins for CORS.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Same value the Prisma CLI reads from the repo-root .env — one URL, one
  // source. No default: an unset database is a startup failure, not a fallback.
  DATABASE_URL: z.url(),
  // Signs access tokens (HS256). No default on purpose: turbo's strict envMode
  // silently blanks undeclared vars, and a blank secret with a fallback would
  // mean silently forgeable tokens instead of a loud bootstrap failure.
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: ttlSchema.default("15m"),
  // Sliding refresh-session lifetime per transport; each rotation extends
  // expiresAt by this much, bounded by an absolute ceiling (see TokenService).
  REFRESH_TTL_WEB: ttlSchema.default("30d"),
  REFRESH_TTL_MOBILE: ttlSchema.default("60d"),
  // Only set in production when web and api share a registrable domain; unset
  // keeps cookies host-only.
  COOKIE_DOMAIN: z.string().optional(),
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
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return result.data;
}
