import { z } from "zod";
import { DeviceType } from "@repo/database/enums";

// Same bridge rule as platform-role.contract.ts: `@repo/database/enums` is the only
// generated module safe to import at runtime here.
export const DeviceTypeSchema = z.enum(DeviceType);

export type DeviceTypeValue = z.infer<typeof DeviceTypeSchema>;
