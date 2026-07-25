import { z } from "zod";
import { Role } from "@repo/database/enums";

/**
 * The single Prisma -> Zod runtime bridge in this package.
 *
 * `@repo/database/enums` is the only generated module that carries no
 * transitive dependency on the Prisma runtime, so it is safe in a browser
 * bundle. Nothing else from `@repo/database` may be imported at runtime here —
 * model types cross as `import type` only.
 */
export const RoleSchema = z.enum(Role);

export type RoleValue = z.infer<typeof RoleSchema>;
