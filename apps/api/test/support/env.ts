import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal .env loader for jest's globalSetup: the app reads the file through
 * ConfigModule, but globalSetup runs before any Nest code exists and apps/api
 * deliberately has no direct dotenv dependency.
 */
export function loadRootEnv(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(__dirname, "../../../../.env"), "utf8");
  } catch {
    return;
  }

  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    const key = match?.[1];
    if (!key || key in process.env) continue;
    const value = (match?.[2] ?? "")
      .replace(/^"(.*)"$/, "$1")
      .replace(/^'(.*)'$/, "$1");
    process.env[key] = value;
  }
}
