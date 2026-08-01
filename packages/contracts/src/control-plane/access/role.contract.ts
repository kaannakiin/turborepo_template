import { z } from "zod";
import type { RoleModel } from "@repo/database/models";
import { PermissionSchema } from "./permission.contract";

export const RoleSchema = z.object({
  publicId: z.cuid2(),
  key: z.string().min(1).max(48),
  name: z.string().min(1).max(80),
  description: z.string().max(240).nullable(),
  permissions: z.array(PermissionSchema),
  /**
   * Derived from `roles.tenantId IS NULL`, never stored — the schema keeps one
   * source of truth for that fact. The tenant id itself does not cross the
   * wire: a caller only ever sees roles from its own tenant plus the system
   * ones, so the column carries no information the client can act on.
   */
  isSystem: z.boolean(),
  createdAt: z.iso.datetime(),
});

/** What a tenant switcher or member row needs; the permission list would be noise. */
export const RoleSummarySchema = RoleSchema.pick({
  publicId: true,
  key: true,
  name: true,
});

export const RoleListSchema = z.array(RoleSchema);

export type Role = z.infer<typeof RoleSchema>;
export type RoleSummary = z.infer<typeof RoleSummarySchema>;

type Expect<T extends true> = T;

/**
 * `isSystem` is excluded because it is derived, and `permissions` is asserted
 * one-way on purpose: the column is `text[]`, the contract narrows it to the
 * catalog. The DB stays deliberately looser so a permission can be retired in
 * code without a migration.
 */
export type RoleContractMatchesPrisma = Expect<
  Exclude<Exclude<keyof Role, "isSystem">, keyof RoleModel> extends never
    ? Role["permissions"] extends RoleModel["permissions"]
      ? true
      : false
    : false
>;
