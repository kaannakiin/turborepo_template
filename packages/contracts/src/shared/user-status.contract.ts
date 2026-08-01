import { z } from "zod";
import { UserStatus } from "@repo/database/enums";

// Same bridge rule as platform-role.contract.ts: `@repo/database/enums` is the only
// generated module safe to import at runtime here.
export const UserStatusSchema = z.enum(UserStatus);

export type UserStatusValue = z.infer<typeof UserStatusSchema>;
