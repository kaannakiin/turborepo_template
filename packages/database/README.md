# `@repo/database`

Prisma is the single source of truth for the data model. This package decides
**who is allowed to import what** — that boundary is enforced by the `exports`
map, not by convention.

## Import rules

| Consumer             | Allowed                                                           | Forbidden               |
| -------------------- | ----------------------------------------------------------------- | ----------------------- |
| `apps/api`           | `@repo/database/server`, `/enums`, `/models`                      | —                       |
| `packages/contracts` | `@repo/database/enums` (runtime), `@repo/database/models` (types) | `@repo/database/server` |
| `apps/web-portal`    | `@repo/database/enums`, `@repo/database/models`                   | `@repo/database/server` |

There is **no root export**. `import ... from "@repo/database"` does not
resolve — the entry point always states its intent.

| Entry     | Contents                                             | Runtime cost in a browser bundle |
| --------- | ---------------------------------------------------- | -------------------------------- |
| `/server` | `PrismaClient`, `createPrismaClient`, driver adapter | blocked (throws at build time)   |
| `/enums`  | enum values (`Role.ADMIN`)                           | a few bytes, tree-shakeable      |
| `/models` | model types only (`UserModel`, `UserWhereInput`, …)  | zero — erased at compile time    |

Three layers keep server code out of the client bundle:

1. `exports["./server"]` maps the `browser` condition to a module that throws
   (`node --conditions=browser -e "require('@repo/database/server')"` to see it).
2. ESLint `no-restricted-imports` — the `browserSafe` block in
   [packages/eslint-config/base.js](../eslint-config/base.js), applied by
   `react-internal` and by contracts. `--max-warnings 0` makes it fail the task.
3. After `pnpm --filter web-portal build`, this must print `0`:
   `grep -rlE "PrismaClient|@prisma/adapter|node:process" apps/web-portal/dist/client | wc -l`

## `@repo/contracts`

Contracts follow the same subpath-only shape (`/shared`, `/auth`, `/admin`, no
root barrel) so a web route importing `@repo/contracts/shared` never pulls admin
schemas into its bundle.

The only runtime value crossing from Prisma into contracts is the enum, in
[src/shared/role.contract.ts](../contracts/src/shared/role.contract.ts):
`z.enum(Role)`. Model _types_ cross as `import type` only, to assert parity —
see `UserContractMatchesPrisma` in `src/admin/users.contract.ts`.

Contracts are **wire types**, Prisma models are **DB types**: `createdAt` is an
ISO string on the wire and a `Date` in Postgres. `z.infer<typeof UserSchema>` is
therefore never asserted equal to `UserModel`; the conversion lives in the API
layer (`toContract` in `apps/api/src/control-plane/platform/users.service.ts`).

## Module format

The package is **CommonJS-typed** (no `"type"` field): `dist/*.js` is CJS,
`dist/*.mjs` is ESM, and there is one `.d.ts` per entry.

That is deliberate. `apps/api` is CommonJS (NestJS + SWC) and `apps/web-portal` is ESM,
while the generated client's `moduleFormat` picks _one_ of `__dirname` /
`import.meta.url`. Keeping the generator on `cjs` and shipping an ESM mirror for
only the dependency-free entries means neither side ever gets code written for
the other module system — and `tsx src/seed.ts` runs straight from source.

## Build

```sh
prisma generate              # -> src/generated/prisma (gitignored)
tsc -p tsconfig.build.json   # -> dist/**  CJS + .d.ts, structure preserved
tsup                         # -> dist/enums.mjs, dist/models.mjs
```

`tsc` transpiles rather than bundles on purpose: the Prisma runtime resolves its
query compiler out of `node_modules/@prisma/client`, and bundling would both
break those paths and force a `.d.ts` rollup over Prisma's whole type surface.

## Commands

| Command                                   | Purpose                          |
| ----------------------------------------- | -------------------------------- |
| `pnpm --filter @repo/database db:push`    | push schema without a migration  |
| `pnpm --filter @repo/database db:migrate` | create + apply a dev migration   |
| `pnpm --filter @repo/database db:deploy`  | apply migrations (CI/production) |
| `pnpm --filter @repo/database db:seed`    | run `src/seed.ts`                |
| `pnpm --filter @repo/database db:studio`  | open Prisma Studio               |

All of them read `DATABASE_URL` from the repository-root `.env`.
