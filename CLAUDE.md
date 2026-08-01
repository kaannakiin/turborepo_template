# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

This is a multi-tenant SaaS platform product. It is installed for a company, whose IT/CTO staff use a control portal (`apps/web-portal`) to stand up and run their own projects — a CRM, a B2B portal, a B2C storefront — and to manage each project's domains, status and users from one place.

That produces two worlds, and every structural rule below exists to keep them apart:

- **control plane** — the platform itself. What the portal drives, plus the machinery the platform provides to every solution (identity, authorization, provisioning). Singular, vendor-owned, shipped once.
- **solutions** — the business applications a tenant stands up. Plural, open-ended, and each one has to stay liftable into its own deployable later.

## Planes

`control-plane/` and `solutions/` are the top-level split in `apps/api/src`, `packages/contracts/src`, and `packages/database/prisma/schema`. Everything else (`common/`, `config/`, `i18n/`, `prisma/`, `types/`, `scripts/`, `health/`) sits outside the planes and anyone may reach it.

The dependency graph is one-way and has no back edges:

```text
solutions/*        ──>  control-plane/*      ok
control-plane/*    ──>  solutions/*          forbidden
solutions/crm      ──>  solutions/commerce   forbidden
anything           ──>  common/ config/ prisma/ i18n/   ok
```

Which plane a new domain belongs to:

> Does the code serve exactly one solution? → `solutions/<name>/`.
> Is it the platform itself, or machinery every solution will need? → `control-plane/`.

That is why end-user identity for solutions will live in `control-plane/`: every solution consumes it, none owns it.

**The mirror invariant.** A domain carries the same two words in all three trees:

```text
apps/api/src/<plane>/<domain>/
packages/contracts/src/<plane>/<domain>/
packages/database/prisma/schema/<plane>/<domain>/
```

A tree where the concept has nothing to hold gets no folder — `platform` and `verification` own no Prisma model, so there is no schema folder for them. But wherever a domain does appear, the name is identical.

**Naming.** `identity` (who are you) and `access` (what may you do) are the two halves of IAM. They replaced `auth`/`authz`, which differed by one letter and blurred on sight. Within a module, module-scoped files take the module name (`identity.module.ts`, `identity.constants.ts`); resource-scoped files keep the resource name (`auth.controller.ts` owns the `/auth` surface, `users.controller.ts` owns `/platform/users`).

Route paths and i18n error keys are **not** derived from folder names — `POST /auth/login` and `errors.auth.unauthorized` are wire contract and do not move when a folder does.

**Enforcement.** `apiPlanes` in `packages/eslint-config/planes.js` makes the plane direction a lint error via `import-x/no-restricted-paths`, which resolves specifiers to real paths. It deliberately does not use `no-restricted-imports`: `apps/api` already sets that rule for `src/**`, and a second block declaring it would replace rather than extend it, silently dropping the `@api/*` guard.

Sibling modules inside one plane are *not* import-restricted, because NestJS DI needs the provider class imported for its constructor type (`platform/users.service.ts` imports `PasswordService` to inject it). The rule that still holds by convention: cross-module access goes through a provider the owning module `exports`, never a reach into its internals.

## Decided, not yet built

Settled with the owner; recorded here so it is not relitigated. None of it exists in the code yet.

1. **A project is a row.** One API process, one Postgres, shared schema. Standing up a project writes a `Project` + `ProjectDomain` row; a request resolves to tenant+project from the `Host` header, and solution tables are row-scoped by `tenantId`/`projectId`. Not a separate deployment, not a database per tenant.
2. **Authorization gains a project axis.** Today's tenant-level `RoleAssignment` stays; a `ProjectMembership (project, membership, role)` axis joins it, because one tenant runs several projects and staffs them differently.
3. **Solution end users are a separate identity.** Portal staff (`User`) and a CRM sales rep or a B2C shopper do not share a table. Separate model, separate auth flow, living in `control-plane/` because every solution consumes it.

## Hard Rules

### Tree-shaking is mandatory for `packages/*`

Every package under `packages/*` that ships runtime code MUST be tree-shakeable — a consumer's bundle must only include what it actually imports. Concretely:

- `"sideEffects": false` in package.json.
- Built with tsup (`treeshake: true`, `splitting: true`), ESM output alongside CJS, `"files": ["dist"]`.
- **Subpath-only exports, no root barrel.** One `exports` entry per domain (e.g. `@repo/contracts/control-plane/tenancy`, `@repo/contracts/shared`). Importing one subpath must never drag another domain into the bundle. `packages/contracts` is the reference implementation — copy its package.json/tsup.config.ts shape for new packages. A plane never gets an aggregating barrel: there is no `@repo/contracts/solutions`, only `@repo/contracts/solutions/<name>`.
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
pnpm turbo run db:studio
```

Tests exist only in `apps/api` (Jest + @swc/jest + supertest):

```sh
pnpm --filter api test        # unit (apps/api/test/unit/**, mirrors the src tree)
pnpm --filter api test:e2e    # supertest against TEST_DATABASE_URL (TRUNCATEs it!)
```

`test:e2e` requires `TEST_DATABASE_URL` in the root `.env` pointing at a throwaway database — the suite truncates every table between spec files and refuses to run when it equals `DATABASE_URL`.

No spec file lives under `apps/api/src`: the SWC builder compiles everything below `sourceRoot`, so a colocated test ends up inside `dist`. Tests reach source through the `@api/*` alias, which is mapped only by `tsconfig.test.json` and jest — never by the build. See `apps/api/CLAUDE.md`.

## Environment

Single root `.env` (see `.env.example`): `DATABASE_URL`, `PORT` (api), `VITE_API_URL` (web, browser-exposed), `CORS_ORIGINS`, `JWT_SECRET` (required, min 32 chars, no default — bootstrap fails without it), optional `JWT_ACCESS_TTL`/`REFRESH_TTL_WEB`/`REFRESH_TTL_MOBILE`/`COOKIE_DOMAIN`, and `TEST_DATABASE_URL` (e2e only). It is read by the API (`envFilePath: ['../../.env']` in app.module.ts) and by Prisma (`packages/database/prisma.config.ts` loads it via dotenv).

`turbo.json` uses `envMode: "strict"`: a task only sees env vars declared in its `env` array. When a task starts needing a new variable, declare it there or it silently reads as empty.

## Architecture

pnpm workspaces + Turborepo. Shared dependency versions go through the `catalog:` in `pnpm-workspace.yaml`; Prisma versions (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) are pinned exactly and must not drift or be bumped independently.

### apps/api — NestJS 11 (SWC build, CJS)

- Global providers wired in `app.module.ts`: `ZodValidationPipe` (nestjs-zod), `AllExceptionsFilter`, `LoggingInterceptor`. Env validated by a Zod schema (`src/config/env.schema.ts`).
- `main.ts` middleware parses `Accept-Language` into `req.locale` (typed in `src/types/express.d.ts`).
- Feature modules under `src/control-plane/*` — `identity`, `verification`, `tenancy`, `access`, `platform` — plus `src/health/`. Not DDD layers, and named after the **domain**, never after a client: there is no `portal/` module, because the solutions a tenant stands up will call the same tenancy/access endpoints the portal does. See `apps/api/CLAUDE.md` for the module-internal layout rule.
- `src/common/` holds what every module may reach: `Principal`, the `@Public`/`@Roles`/`@CurrentUser` decorators, and the globally registered guards.
- `src/prisma/prisma.service.ts` is the only file that may import `@repo/database/server`.

### apps/web-portal — React 19 + TanStack Start + Vite + Tailwind v4

- `vite.config.ts` plugin order matters: tailwindcss → tanstackStart → viteReact.
- `router.tsx` creates a fresh i18next instance per SSR request so concurrent requests in different languages don't share state.
- Locale is a cookie, read/written isomorphically in `src/i18n/locale.ts` via `createIsomorphicFn`.

### packages/contracts — `@repo/contracts`

Plain Zod schemas + inferred types (no ts-rest). One domain folder per subpath export — `shared/` (plane-neutral primitives) and `control-plane/{identity,tenancy,access,platform}/` — each with `*.contract.ts` files and a domain-local barrel. No root export by design. The folder names match the `apps/api` modules and the Prisma schema folders; a new subpath is registered twice, in `package.json` `exports` and in `tsup.config.ts` `entry`, or it silently fails to resolve. A slash in a tsup `entry` key becomes an output subdirectory, which is what carries the plane prefix into `dist/`.

Relative imports across domain folders inside this package are fine and deliberate — `tsup`'s `splitting: true` lifts the shared code into one chunk instead of duplicating it per entry. The boundary that matters here is the plane, not the domain.

Each `*.contract.ts` is written in one order: entity schema → request/response schemas **derived** from it with `.pick`/`.omit`/`.extend` → `z.infer` types → a Prisma parity type (`UserContractMatchesPrisma` in `control-plane/platform/users.contract.ts` is the reference). The parity type is what proves at compile time that the wire shape has not drifted from the model; a schema that hand-rewrites fields the entity already declares loses that guarantee.

Where a schema restates a database CHECK constraint (`TenantSlugSchema`, `PhoneE164Schema`), the two must match character for character. If the contract is looser the API answers 500 instead of 400.

### packages/database — `@repo/database`

- Prisma 7, multi-file schema in `prisma/schema/` organized by plane and domain (`control-plane/{identity,tenancy,access}/`), mirroring contracts. The folder scan is recursive, so nesting a plane above the domain costs nothing. Generator config lives in `prisma/schema/schema.prisma`; client is generated into `src/generated/prisma` (CJS). There is no separate `enums.prisma`: each enum lives in the file of the model that uses it (`PlatformRole`/`UserStatus` in `control-plane/identity/user.prisma`, `DeviceType` in `control-plane/identity/device.prisma`, …).
- `users.email` is `CITEXT`, so the initial migration hand-adds `CREATE EXTENSION citext` — Prisma emits the column type but never the extension.
- Exactly three public entries:
  - `/server` — PrismaClient + pg adapter. CJS-only, consumed only by apps/api. Under the `browser` export condition it resolves to a stub that throws.
  - `/enums` — enum runtime values, browser-safe.
  - `/models` — `export type *` only, zero runtime bytes.
- No root export; `import ... from "@repo/database"` does not resolve.

### packages/i18n — `@repo/i18n`

i18next instance factory, locale helpers (`DEFAULT_LOCALE`, `LOCALE_COOKIE`, `parseAcceptLanguage`), and JSON resources for `en`/`tr` (namespaces: `common`, `errors`, `validation`). `@repo/i18n/zod` provides the Zod error map and is a separate subpath so non-Zod consumers don't pull it in.

### Import boundaries (all enforced, none by convention alone)

1. **Server-only code out of browser bundles.** `apps/web-portal` and `packages/contracts` may only import `@repo/database/enums` and `@repo/database/models` — never `/server`, `@prisma/client`, `@prisma/adapter-*`, or `pg`. Enforced twice: the `browserSafe` rule set in `packages/eslint-config/base.js` (lint error at the import site) and the `browser` export condition on `@repo/database/server` (throws if it reaches a client bundle anyway).
2. **Plane direction inside `apps/api`.** `apiPlanes` in `packages/eslint-config/planes.js`.
3. **`apps/web-portal` is a control-plane client.** `browserSafe` also blocks `@repo/contracts/solutions/*`.
4. **The test-only `@api/*` alias.** `apps/api/eslint.config.mjs`, plus `tsconfig.json` declaring no `paths`.

### TypeScript configs (`packages/typescript-config`)

- `base.json`: NodeNext, strict, ES2022.
- `nestjs.json`: Node16 resolution (node10 would ignore `exports` maps, breaking `@repo/*` subpath types), decorators, no emit (SWC emits).
- `vite-app.json` / bundled packages: `moduleResolution: Bundler`, `noEmit`.
- `packages/database` keeps NodeNext/CJS resolution to match the generated client's `moduleFormat = "cjs"`.
