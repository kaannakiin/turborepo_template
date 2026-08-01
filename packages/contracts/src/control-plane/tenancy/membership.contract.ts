import { z } from "zod";
import type { MembershipModel } from "@repo/database/models";
import { RoleSummarySchema } from "../access/role.contract";
import { MembershipStatusSchema } from "../../shared/membership-status.contract";
import { TenantSchema } from "./tenant.contract";

export const MembershipSchema = z.object({
  publicId: z.cuid2(),
  status: MembershipStatusSchema,
  joinedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

/**
 * One row of the caller's own tenant list — what the portal's tenant switcher
 * renders. Keyed on the membership rather than the tenant because that is the
 * id a tenant switch has to send back.
 */
export const MyTenantSchema = z.object({
  membership: MembershipSchema,
  tenant: TenantSchema,
  roles: z.array(RoleSummarySchema),
});

export const MyTenantListSchema = z.array(MyTenantSchema);

export type Membership = z.infer<typeof MembershipSchema>;
export type MyTenant = z.infer<typeof MyTenantSchema>;

type Expect<T extends true> = T;

export type MembershipContractMatchesPrisma = Expect<
  Exclude<keyof Membership, keyof MembershipModel> extends never
    ? [Membership["status"]] extends [MembershipModel["status"]]
      ? [MembershipModel["status"]] extends [Membership["status"]]
        ? true
        : false
      : false
    : false
>;
