import { z } from "zod";
import { PhoneE164Schema } from "../../shared/phone.contract";
import { PlatformRoleSchema } from "../../shared/platform-role.contract";
import { UserStatusSchema } from "../../shared/user-status.contract";

// Verification bound, not the registration policy bound: min(8) belongs to
// account creation. A credential that predates a stricter policy must still be
// able to log in, so login only requires presence.
const loginPasswordSchema = z.string().min(1).max(128);

export interface CreateLoginRequestSchemaOptions {
  /**
   * Metadata-backed E.164 validity check, layered on top of the structural
   * regex. Must be synchronous — see createRegisterRequestSchema for why and
   * for how each app obtains it.
   */
  isValidPhone?: (value: string) => boolean;
}

export function createLoginRequestSchema(
  options: CreateLoginRequestSchemaOptions = {},
) {
  const { isValidPhone } = options;

  const phoneSchema = isValidPhone
    ? PhoneE164Schema.refine(isValidPhone, {
        error: "validation.phone.invalid",
      })
    : PhoneE164Schema;

  return z.discriminatedUnion("method", [
    z.object({
      method: z.literal("email"),
      email: z.email({ error: "validation.email.invalid" }),
      password: loginPasswordSchema,
    }),
    z.object({
      method: z.literal("phone"),
      phone: phoneSchema,
      password: loginPasswordSchema,
    }),
  ]);
}

export const LoginRequestSchema = createLoginRequestSchema();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const SessionUserSchema = z.object({
  publicId: z.cuid2(),
  email: z.email().nullable(),
  phone: PhoneE164Schema.nullable(),
  name: z.string(),
  surname: z.string(),
  platformRole: PlatformRoleSchema,
  status: UserStatusSchema,
});

export type SessionUser = z.infer<typeof SessionUserSchema>;

// One response shape for both transports: token fields are present only for
// bearer clients (X-Client-Type: mobile); web clients get the same tokens as
// httpOnly cookies and receive `user` alone.
export const LoginResponseSchema = z.object({
  user: SessionUserSchema,
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive().optional(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;
