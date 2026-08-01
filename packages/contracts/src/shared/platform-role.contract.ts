import { z } from "zod";
import { PlatformRole } from "@repo/database/enums";

/**
 * Prisma -> Zod runtime bridge (see also user-status/device-type contracts).
 *
 * `@repo/database/enums` is the only generated module that carries no
 * transitive dependency on the Prisma runtime, so it is safe in a browser
 * bundle. Nothing else from `@repo/database` may be imported at runtime in
 * this package — model types cross as `import type` only.
 *
 * Platform axis only — who operates the SaaS. Authority inside a tenant comes
 * from Membership + RoleAssignment and travels as permission keys, not as an
 * enum; see `@repo/contracts/control-plane/access`.
 */
export const PlatformRoleSchema = z.enum(PlatformRole);

export type PlatformRoleValue = z.infer<typeof PlatformRoleSchema>;
