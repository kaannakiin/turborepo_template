// Enum values only — no transitive dependencies, safe in a browser bundle and
// the best target for tree shaking. This is the one runtime surface of the
// package that frontend code and `@repo/contracts` may import.
export * from "./generated/prisma/enums";
