# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Hard Rules

### Tree-shaking is mandatory for `packages/*`

Every package under `packages/*` that ships runtime code MUST be tree-shakeable — a consumer's bundle must only include what it actually imports. Concretely:

- `"sideEffects": false` in package.json.
- Built with tsup (`treeshake: true`, `splitting: true`), ESM output alongside CJS, `"files": ["dist"]`.
- **Subpath-only exports, no root barrel.** One `exports` entry per domain (e.g. `@repo/contracts/admin`, `@repo/contracts/shared`). Importing one subpath must never drag another domain into the bundle. `packages/contracts` is the reference implementation — copy its package.json/tsup.config.ts shape for new packages.
- `packages/i18n` has a root `.` barrel; it is a grandfathered exception, not a pattern to repeat.

### Comments

Never add unnecessary comments. The only permitted comments state a constraint the code cannot express (why a config value must be what it is, why an export map is shaped a certain way). No narrative comments, no "what this does" comments, no comments explaining a change.

### Skills

Skill packs live in `.agents/skills/` (symlinked at `.claude/skills/`, tracked in `skills-lock.json`). Read the matching skill before working in its area:

- `prisma-cli` — Prisma CLI commands and migration workflows
- `shadcn` — component usage; its `rules/` subfolder covers styling, forms, composition, icons (semantic tokens only, `FieldGroup`/`Field` for forms, no `space-*` utilities, etc.)
- `turborepo`, `zod`, `react-hook-form`
- `postgresql-code-review`, `postgresql-optimization`
- `vercel-react-best-practices`, `vercel-react-view-transitions`

## Commands

```sh
pnpm dev              # turbo run dev (api on :4000, web on :3000)
pnpm build            # turbo run build
pnpm lint             # eslint, --max-warnings 0 everywhere
pnpm check-types      # tsc --noEmit everywhere
pnpm format           # prettier --write
pnpm clean            # remove node_modules/dist/.tanstack

# Single workspace
pnpm --filter api dev
pnpm turbo run build --filter=@repo/contracts

# Database (run via turbo or inside packages/database)
pnpm turbo run generate      # prisma generate (cached; also runs before build/dev)
pnpm turbo run db:migrate    # prisma migrate dev
pnpm turbo run db:deploy     # prisma migrate deploy
pnpm turbo run db:push
pnpm turbo run db:seed
pnpm turbo run db:studio
```

There is no test infrastructure — no test runner, no test scripts anywhere.

## Environment

Single root `.env` (see `.env.example`): `DATABASE_URL`, `PORT` (api), `VITE_API_URL` (web, browser-exposed), `CORS_ORIGINS`. It is read by the API (`envFilePath: ['../../.env']` in app.module.ts) and by Prisma (`packages/database/prisma.config.ts` loads it via dotenv).

`turbo.json` uses `envMode: "strict"`: a task only sees env vars declared in its `env` array. When a task starts needing a new variable, declare it there or it silently reads as empty.

## Architecture

pnpm workspaces + Turborepo. Shared dependency versions go through the `catalog:` in `pnpm-workspace.yaml`; Prisma versions (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) are pinned exactly and must not drift or be bumped independently.

### apps/api — NestJS 11 (SWC build, CJS)

- Global providers wired in `app.module.ts`: `ZodValidationPipe` (nestjs-zod), `AllExceptionsFilter`, `LoggingInterceptor`. Env validated by a Zod schema (`src/config/env.schema.ts`).
- `main.ts` middleware parses `Accept-Language` into `req.locale` (typed in `src/types/express.d.ts`).
- Feature modules under `src/modules/*` (controller/service/module, DTOs built from `@repo/contracts` schemas).
- `src/prisma/prisma.service.ts` is the only file that may import `@repo/database/server`.

### apps/web — React 19 + TanStack Start + Vite + Tailwind v4

- `vite.config.ts` plugin order matters: tailwindcss → tanstackStart → viteReact.
- `router.tsx` creates a fresh i18next instance per SSR request so concurrent requests in different languages don't share state.
- Locale is a cookie, read/written isomorphically in `src/i18n/locale.ts` via `createIsomorphicFn`.

### packages/contracts — `@repo/contracts`

Plain Zod schemas + inferred types (no ts-rest). One domain folder per subpath export: `shared/`, `auth/`, `admin/`, each with `*.contract.ts` files and a domain-local barrel. No root export by design.

### packages/database — `@repo/database`

- Prisma 7, multi-file schema in `prisma/schema/` organized by domain folders (`admin/`, `shared/`), mirroring contracts. Generator config lives in `prisma/schema/schema.prisma`; client is generated into `src/generated/prisma` (CJS).
- Exactly three public entries:
  - `/server` — PrismaClient + pg adapter. CJS-only, consumed only by apps/api. Under the `browser` export condition it resolves to a stub that throws.
  - `/enums` — enum runtime values, browser-safe.
  - `/models` — `export type *` only, zero runtime bytes.
- No root export; `import ... from "@repo/database"` does not resolve.

### packages/i18n — `@repo/i18n`

i18next instance factory, locale helpers (`DEFAULT_LOCALE`, `LOCALE_COOKIE`, `parseAcceptLanguage`), and JSON resources for `en`/`tr` (namespaces: `common`, `errors`, `validation`). `@repo/i18n/zod` provides the Zod error map and is a separate subpath so non-Zod consumers don't pull it in.

### Import boundary (enforced twice)

`apps/web` and `packages/contracts` may only import `@repo/database/enums` and `@repo/database/models` — never `/server`, `@prisma/client`, `@prisma/adapter-*`, or `pg`. Enforcement:

1. `browserSafe` rule set in `packages/eslint-config/base.js` (lint error at the import site).
2. The `browser` export condition on `@repo/database/server` (throws if it reaches a client bundle anyway).

### TypeScript configs (`packages/typescript-config`)

- `base.json`: NodeNext, strict, ES2022.
- `nestjs.json`: Node16 resolution (node10 would ignore `exports` maps, breaking `@repo/*` subpath types), decorators, no emit (SWC emits).
- `vite-app.json` / bundled packages: `moduleResolution: Bundler`, `noEmit`.
- `packages/database` keeps NodeNext/CJS resolution to match the generated client's `moduleFormat = "cjs"`.
