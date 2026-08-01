import { z } from "zod";
import { TenantStatus } from "@repo/database/enums";

// Same bridge rule as platform-role.contract.ts: `@repo/database/enums` is the only
// generated module safe to import at runtime here.
export const TenantStatusSchema = z.enum(TenantStatus);

export type TenantStatusValue = z.infer<typeof TenantStatusSchema>;
