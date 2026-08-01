# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scoped to `apps/api`. The repo-root `CLAUDE.md` covers monorepo-wide rules (tree-shaking, package exports, import boundaries) and is not repeated here.

## Commands

```sh
pnpm --filter api dev          # nest start --watch, listens on PORT (default 4000)
pnpm --filter api build        # nest build
pnpm --filter api check-types  # tsc --noEmit
pnpm --filter api lint         # eslint . --max-warnings 0
```

`nest-cli.json` sets `builder: "swc"` with `typeCheck: false` — **`build` does not typecheck**. `check-types` is the only type gate; a green build says nothing about type correctness.

```sh
pnpm --filter api test         # unit: test/unit/**, @swc/jest (reads .swcrc)
pnpm --filter api test:e2e     # test/e2e/**, serial, against TEST_DATABASE_URL
```

No test file lives under `src`. The SWC builder compiles everything below `sourceRoot`, so a colocated `*.spec.ts` ships inside `dist` — keeping tests in `test/` is what prevents that, not a build flag.

```text
test/
  unit/       mirrors the src tree (test/unit/control-plane/identity/services/…)
  e2e/        *.e2e-spec.ts
  support/    e2e-utils.ts, env.ts, setup-e2e.ts
```

E2E notes: `test/support/setup-e2e.ts` swaps `DATABASE_URL` for `TEST_DATABASE_URL` (refusing to run if they match — the suite TRUNCATEs every table), runs `prisma migrate deploy`, and every spec boots the real `AppModule` through the same `configureApp()` as `main.ts`. The `NODE_OPTIONS=--experimental-vm-modules` flag in `test:e2e` is required by Prisma 7's runtime dynamic imports under Jest. Throttling is skipped under `NODE_ENV=test` unless `THROTTLE_E2E=1` (see `test/e2e/auth-throttle.e2e-spec.ts`).

### The `@api/*` alias is test-only

Tests import source as `@api/control-plane/identity/services/session.service`. The alias is mapped in exactly two places — `paths` in `tsconfig.test.json` and `moduleNameMapper` in `jest.config.js` / `test/jest-e2e.json` — and both are outside the build.

Using it inside `src` is a bug, blocked twice: `tsconfig.json` declares no `paths`, so `check-types` reports TS2307 at the import site, and an ESLint `no-restricted-imports` rule scoped to `src/**` names the reason. It cannot be made to work by adding `jsc.paths` to `.swcrc` — SWC rewriting specifiers at build time is precisely the silent-failure mode this arrangement exists to avoid.

`check-types` therefore runs two programs: `tsc --noEmit` for `src`, then `tsc -p tsconfig.test.json` for `test`.

## Zod rules

Schemas come from `@repo/contracts`, but these rules are enforced here because this app is where a violation actually breaks: `ZodValidationPipe` is registered globally in `app.module.ts` and validates every `@Body()`.

### Use `.check()`, not `.superRefine()`

Zod v4 made `.check()` the primitive for cross-field validation. `.superRefine()` still exists as v3-compat ergonomics — do not reach for it in new code.

```ts
z.discriminatedUnion("method", [...]).check((ctx) => {
  if (ctx.value.password !== ctx.value.passwordConfirm) {
    ctx.issues.push({
      code: "custom",
      input: ctx.value.passwordConfirm,
      path: ["passwordConfirm"],
      message: "validation.password.mismatch",
    });
  }
});
```

`ctx` is `ParsePayload<T>` — `{ value, issues }` — so issues are pushed directly rather than through an `addIssue` helper. Both `.check()` and `.superRefine()` return `this` (v4 dropped the `ZodEffects` wrapper), so a refined `ZodDiscriminatedUnion` still infers a narrowable union and still works as a `createZodDto` base.

### Naming

Exported schemas are `PascalCase` + `Schema` (`RegisterRequestSchema`, `PhoneE164Schema`); module-local ones stay `camelCase` (`nameSchema`, `passwordSchema`, `credentialsShape`). The casing is the signal for what is part of the contract's public surface.

### Schemas must be synchronous

`ZodValidationPipe` calls `schema.parse()`, never `parseAsync`. An async check (`.check(async ...)`, an async `.refine`) throws "Encountered Promise during synchronous parse" on **every** request that hits the endpoint.

When a schema needs a validator that is only available asynchronously — e.g. `@repo/utils/phone`, which `apps/web-portal` must lazy-load to keep libphonenumber-js metadata out of its entry bundle — inject it through a factory instead. The asynchrony belongs to _building_ the schema, never to _running_ it. See `createRegisterRequestSchema` in `packages/contracts/src/control-plane/identity/register.contract.ts`; this app imports the validator statically because Node has no bundle-size constraint.

### Error messages are i18n keys, never prose

A schema-level `error` / issue `message` written as a dotted key (`"validation.phone.invalid"`) is matched by `isTranslationKey` in `@repo/i18n/zod` and resolved per request. Anything else falls back to a generic key derived from the issue code.

## Architecture

### Layout

```text
src/
  common/       decorators/  guards/  filters/  interceptors/
                principal.ts  prisma-errors.ts
  config/  i18n/  prisma/  scripts/  types/
  health/       liveness of this process, not a domain — outside the planes
  control-plane/
    identity/       identity.module.ts  identity.constants.ts  identity.types.ts
                    controllers/  services/  strategies/  guards/  dto/
    verification/   OTP request/confirm — own module, own constants
    tenancy/        tenants + memberships + invitations
    access/         roles + the permission catalog endpoint
    platform/       platform-staff administration (`/platform/*`)
  solutions/        one folder per tenant-facing solution — none yet
```

The two planes and their one-way dependency graph are defined in the repo-root `CLAUDE.md`; this file covers what happens inside a module.

**Modules are named after the domain they own, never after the client that calls them.** There is no `portal/` module: the portal is one consumer, and the solutions a tenant stands up will call the same tenancy and access endpoints. A folder named after a caller becomes a lie the moment the second caller appears.

The control plane has four domains today — `identity` (who are you), `tenancy` (which organizations), `access` (what may you do), `platform` (what may _we_ do) — with `verification` hanging off `identity`. The same words name the Prisma schema folders and the `@repo/contracts` subpaths, so a new concept has exactly one obvious home in all three trees.

`identity`/`access` are the two halves of IAM, and they replaced `auth`/`authz` for a plain reason: one letter apart, they blurred on sight in import lists. `admin` is deliberately absent too — in this product a tenant has its own admins, so the word cannot say whose authority it means. `platform` means the vendor's staff and nothing else.

Folder names are not route paths. `/auth/login`, `/auth/verify/confirm` and the `errors.auth.*` i18n keys are wire contract; they live in `@Controller` decorators and translation files, and they do not move when a folder is renamed.

Feature modules, not DDD layers: the domain model already exists twice outside this app (Prisma models and Zod contracts), so entities plus mappers would be a third copy. The one boundary worth keeping explicit is the row → wire conversion (`toContract`).

### Module-internal layout

A kind (controller / service / dto / guard / strategy) earns its own subfolder when the **second** file of that kind appears. Until then the file sits at the module root as `<noun>.controller.ts`. `health/health.controller.ts` is right; `health/controllers/health.controller.ts` is ceremony. `identity/` has six services, so it has `services/`.

Module-scoped files take the module name; resource-scoped files take the resource name. `identity.module.ts`, `identity.constants.ts` and `identity.types.ts` describe the module; `auth.controller.ts` and `auth.service.ts` own the `/auth` surface and keep that name, as `platform/users.controller.ts` does — because `tenants.controller.ts` will join it there.

What decides whether something lives in `common/` or in a module: `common/` holds what any module may reach for — the `Principal` shape, the `@Public`/`@Roles`/`@CurrentUser` decorators, and the two guards registered as `APP_GUARD`. `LocalAuthGuard` stays in `control-plane/identity` because only the auth controller can use it.

Cross-module access goes through a provider the owning module `exports`, never a reach into its internals: `platform` depends on `IdentityModule`'s exported `PasswordService` through DI. That import is not lint-restricted and cannot be — NestJS needs the provider class imported for the constructor's parameter type. The restriction that _is_ mechanical is the plane direction (`apiPlanes` in `packages/eslint-config/planes.js`); within a plane the rule is upheld by the shape of the dependency, not by a linter.

Tenant context resolution ("which tenant is this request for?") belongs in `common/` for the same reason — `tenancy`, `access` and `platform` all need the same answer, so it cannot live inside any one of them.

`verification` is a separate module rather than a folder inside `identity`: it touches no identity service, only `PrismaService` and the principal the global `JwtAuthGuard` already attached. Its routes still live under `auth/verify` — the path is in the `@Controller` decorator, not the folder name.

### Request pipeline

Registered globally in `app.module.ts`: `ZodValidationPipe` (APP_PIPE), `AllExceptionsFilter` (APP_FILTER), `LoggingInterceptor` (APP_INTERCEPTOR). `I18nModule` and `PrismaModule` are both `@Global()`, so feature modules inject `I18nService` / `PrismaService` without importing anything.

`main.ts` runs an Express middleware before everything else that parses `Accept-Language` into `req.locale` (declaration-merged onto `Express.Request` in `src/types/express.d.ts`).

### Error contract

Every error — thrown, uncaught, or validation — exits through `AllExceptionsFilter` as:

```
{ statusCode, code, message, path, timestamp, errors? }
```

`code` is an `@repo/i18n` translation key, echoed verbatim as the wire-level error code; `message` is that key rendered in the request's locale. To throw a localized error, pass a key and params instead of a string:

```ts
throw new NotFoundException({ code: "errors.users.notFound", params: { id } });
```

Validation failures arrive as `ZodValidationException`; the filter maps every issue into the `errors[]` array via `translateZodIssues` (`@repo/i18n/zod`), which wraps `resolveZodIssueKey` with the request-scoped translator. Statuses with no explicit key fall back via `STATUS_FALLBACK_KEY`.

### DTOs

Derived from the shared contract with `createZodDto`, never redeclared as classes with decorators:

```ts
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```

`createZodDto` only requires a `.parse()` method, so unions and refined schemas work as bases.

### Prisma

`src/prisma/prisma.service.ts` is the only file in the repo permitted to import `@repo/database/server`; it extends `PrismaClient` and disconnects on `onModuleDestroy`.

Prisma error codes are matched **structurally** (`P2002` unique violation, `P2025` not found) rather than by importing `PrismaClientKnownRequestError`, which lives behind `@prisma/client/runtime` — a path this app deliberately does not reach into. See `hasPrismaCode` in `src/common/prisma-errors.ts`.

Services convert DB rows to wire types explicitly (`toContract`) because Postgres returns `Date` objects and JSON can only carry strings. The contract type is not `UserModel`.

### Config

`validateEnv` (`src/config/env.schema.ts`) runs through `ConfigModule.forRoot({ validate })` and fails at bootstrap rather than at the first request reading a missing variable. `.env` is the repo root's single file (`envFilePath: ['../../.env']`). Read values as `config.get('PORT', { infer: true })` against `ConfigService<Env, true>`.

### TypeScript

`tsconfig.json` extends `@repo/typescript-config/nestjs.json`, which uses **Node16** module resolution. This is load-bearing: node10 resolution ignores `exports` maps, which would break every `@repo/*` subpath import. `outDir` must stay in this file, not the shared preset — TypeScript resolves `extends` paths relative to the file that declares them.
