import { z } from "zod";
import { DeviceTypeSchema } from "../../shared/device-type.contract";

export const DeviceSummarySchema = z.object({
  publicId: z.cuid2(),
  displayName: z.string().nullable(),
  deviceType: DeviceTypeSchema,
  osName: z.string().nullable(),
  browserName: z.string().nullable(),
});

export type DeviceSummary = z.infer<typeof DeviceSummarySchema>;

// Coarse geo only. Raw ipAddress, lat/long, ASN and ISP stay server-side: the
// list exists so a user can spot a suspicious login, not to expose
// fraud-analysis-grade personal data over the wire.
export const SessionListItemSchema = z.object({
  publicId: z.cuid2(),
  current: z.boolean(),
  device: DeviceSummarySchema.nullable(),
  city: z.string().nullable(),
  countryCode: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
});

export type SessionListItem = z.infer<typeof SessionListItemSchema>;

// Flat array by design: the per-user session cap bounds the result set, so the
// shared paginated() envelope would be dead weight here.
export const SessionListSchema = z.array(SessionListItemSchema);

export type SessionList = z.infer<typeof SessionListSchema>;

export const LogoutResponseSchema = z.object({
  success: z.literal(true),
});

export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
