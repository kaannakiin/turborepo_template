import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/schema/migrations",
    // The seed lives in apps/api, not here: it needs the permission catalog
    // from @repo/contracts, and @repo/contracts already depends on this
    // package — importing it back would make the workspace graph cyclic and
    // turbo would refuse to build. Shelling out keeps the graph acyclic.
    seed: "pnpm --filter api db:seed",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
