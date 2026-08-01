import { z } from "zod";
import { MembershipStatus } from "@repo/database/enums";

// Same bridge rule as platform-role.contract.ts: `@repo/database/enums` is the only
// generated module safe to import at runtime here.
export const MembershipStatusSchema = z.enum(MembershipStatus);

export type MembershipStatusValue = z.infer<typeof MembershipStatusSchema>;
