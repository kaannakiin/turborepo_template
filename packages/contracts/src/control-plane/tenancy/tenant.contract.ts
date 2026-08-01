import { z } from "zod";
import type { TenantModel } from "@repo/database/models";
import { TenantStatusSchema } from "../../shared/tenant-status.contract";

/**
 * Mirrors the `tenants_slug_dns_label` CHECK character for character. Where the
 * two drift the database wins and the API answers 500 instead of 400 — the
 * exact failure the phone contract already had to be corrected for.
 *
 * The column is Citext, so uppercase would not collide safely; the pattern
 * enforces the lowercase form the CHECK requires.
 */
export const TenantSlugSchema = z
  .string()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/, {
    error: "validation.tenant.slug",
  });

export const TenantSchema = z.object({
  publicId: z.cuid2(),
  slug: TenantSlugSchema,
  name: z.string().min(1).max(120),
  status: TenantStatusSchema,
  createdAt: z.iso.datetime(),
});

export const CreateTenantSchema = TenantSchema.pick({
  slug: true,
  name: true,
});

// The slug is a subdomain and stays globally unique even after a soft delete,
// so it is claimed once and never edited.
export const UpdateTenantSchema = TenantSchema.pick({ name: true }).partial();

export type Tenant = z.infer<typeof TenantSchema>;
export type CreateTenant = z.infer<typeof CreateTenantSchema>;
export type UpdateTenant = z.infer<typeof UpdateTenantSchema>;

type Expect<T extends true> = T;

export type TenantContractMatchesPrisma = Expect<
  Exclude<keyof Tenant, keyof TenantModel> extends never
    ? [Tenant["status"]] extends [TenantModel["status"]]
      ? [TenantModel["status"]] extends [Tenant["status"]]
        ? true
        : false
      : false
    : false
>;
