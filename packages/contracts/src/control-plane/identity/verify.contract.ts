import { z } from "zod";
import { AuthTokenPurpose } from "@repo/database/enums";

// PASSWORD_RESET is deliberately excluded: reset is an unauthenticated flow
// with different anti-enumeration requirements and is out of scope here.
export const VerifyPurposeSchema = z.enum([
  AuthTokenPurpose.EMAIL_VERIFICATION,
  AuthTokenPurpose.PHONE_VERIFICATION,
]);

export type VerifyPurpose = z.infer<typeof VerifyPurposeSchema>;

export const VerifyRequestSchema = z.object({
  purpose: VerifyPurposeSchema,
});

export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const VerifyConfirmSchema = z.object({
  purpose: VerifyPurposeSchema,
  code: z.string().regex(/^\d{6}$/),
});

export type VerifyConfirm = z.infer<typeof VerifyConfirmSchema>;

export const VerifyAckSchema = z.object({
  accepted: z.literal(true),
});

export type VerifyAck = z.infer<typeof VerifyAckSchema>;
