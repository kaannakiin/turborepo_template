import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { loadRootEnv } from "./env";

export default function globalSetup(): void {
  loadRootEnv();

  const testUrl = process.env.TEST_DATABASE_URL;
  if (!testUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set — the e2e suite refuses to run against an unspecified database.",
    );
  }
  if (testUrl === process.env.DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL must not equal DATABASE_URL — the e2e suite TRUNCATEs every table between specs.",
    );
  }

  // Jest workers inherit this process's env, so the app under test connects to
  // the test database even though ConfigModule also reads the root .env
  // (existing process.env keys win over env-file values).
  process.env.DATABASE_URL = testUrl;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: resolve(__dirname, "../../../../packages/database"),
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: "inherit",
  });
}
