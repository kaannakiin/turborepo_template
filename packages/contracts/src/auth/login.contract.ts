import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.iso.datetime(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
