import { z } from "zod";

/**
 * The permission catalog is code, not data. `roles.permissions` stores only the
 * granted keys, so adding a permission is a deploy rather than a migration, and
 * a typo in `@RequirePermission` fails the build instead of silently denying at
 * runtime.
 */
export const PERMISSION_KEYS = [
  "tenant:read",
  "tenant:update",
  "member:read",
  "member:invite",
  "member:update",
  "member:remove",
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "session:read",
  "session:revoke",
] as const;

export type Permission = (typeof PERMISSION_KEYS)[number];

export const PermissionSchema = z.enum(PERMISSION_KEYS);

export const PERMISSION_GROUPS = [
  "tenant",
  "member",
  "role",
  "session",
] as const;

export type PermissionGroup = (typeof PERMISSION_GROUPS)[number];

export type PermissionDefinition = {
  group: PermissionGroup;
  /**
   * Permissions this one is useless without. The role editor must add them, or
   * a tenant admin can save a role that can update a member it cannot list.
   */
  requires: readonly Permission[];
  /** Surfaced with a confirmation step in the role editor. */
  dangerous?: true;
};

export const PERMISSION_CATALOG: Record<Permission, PermissionDefinition> = {
  "tenant:read": { group: "tenant", requires: [] },
  "tenant:update": { group: "tenant", requires: ["tenant:read"] },

  "member:read": { group: "member", requires: [] },
  "member:invite": { group: "member", requires: ["member:read", "role:read"] },
  "member:update": { group: "member", requires: ["member:read"] },
  "member:remove": {
    group: "member",
    requires: ["member:read"],
    dangerous: true,
  },

  "role:read": { group: "role", requires: [] },
  "role:create": { group: "role", requires: ["role:read"] },
  "role:update": { group: "role", requires: ["role:read"] },
  "role:delete": { group: "role", requires: ["role:read"], dangerous: true },

  "session:read": { group: "session", requires: [] },
  "session:revoke": {
    group: "session",
    requires: ["session:read"],
    dangerous: true,
  },
};

/**
 * i18n key for a permission's display label. Derived rather than stored so the
 * catalog cannot drift from the resource files.
 */
export const permissionLabelKey = (permission: Permission): string =>
  `authz.permission.${permission.replace(":", ".")}`;

export const PermissionCatalogEntrySchema = z.object({
  key: PermissionSchema,
  group: z.enum(PERMISSION_GROUPS),
  requires: z.array(PermissionSchema),
  dangerous: z.boolean(),
  labelKey: z.string(),
});

export const PermissionCatalogSchema = z.array(PermissionCatalogEntrySchema);

export type PermissionCatalogEntry = z.infer<
  typeof PermissionCatalogEntrySchema
>;

/**
 * Wire form of the catalog, flattened once at module load. `GET /permissions`
 * hands this back verbatim and the role editor renders it — deriving it in
 * either place would let the two drift.
 */
export const PERMISSION_CATALOG_LIST: readonly PermissionCatalogEntry[] =
  PERMISSION_KEYS.map((key) => ({
    key,
    group: PERMISSION_CATALOG[key].group,
    requires: [...PERMISSION_CATALOG[key].requires],
    dangerous: PERMISSION_CATALOG[key].dangerous === true,
    labelKey: permissionLabelKey(key),
  }));

/**
 * Closes a selection over `requires`. `requires` is acyclic and one level deep
 * today; the loop keeps that from becoming a correctness assumption.
 */
export const resolvePermissions = (
  selected: readonly Permission[],
): Permission[] => {
  const resolved = new Set<Permission>();
  const pending = [...selected];

  while (pending.length > 0) {
    const permission = pending.pop()!;
    if (resolved.has(permission)) continue;
    resolved.add(permission);
    pending.push(...PERMISSION_CATALOG[permission].requires);
  }

  return PERMISSION_KEYS.filter((key) => resolved.has(key));
};
