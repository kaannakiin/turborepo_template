import { z } from "zod";

// Web transports the refresh token as an httpOnly cookie, so the body field is
// optional; only bearer clients (X-Client-Type: mobile) send it here.
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
