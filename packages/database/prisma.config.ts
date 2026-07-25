import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma v7 no longer loads `.env` on its own. The repo keeps a single root
// `.env` so the CLI here and the API at runtime read the same value.
config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx ./src/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
