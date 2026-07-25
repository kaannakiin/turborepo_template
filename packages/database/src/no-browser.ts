// Resolved instead of `server.ts` under the `browser` export condition, so a
// bundler pulling the database client into a client bundle fails loudly and
// with an actionable message rather than dragging `pg` and `node:*` along.
throw new Error(
  "@repo/database/server is server-only and cannot be bundled for the browser. " +
    "Use @repo/database/enums (runtime values) or @repo/database/models (types) instead.",
);
