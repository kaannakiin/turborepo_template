import { z } from "zod";

export const HealthSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
  timestamp: z.iso.datetime(),
});

export type Health = z.infer<typeof HealthSchema>;
