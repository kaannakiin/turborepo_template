import { z } from "zod";

/**
 * Structural E.164 check only. `packages/contracts` ships to apps/web-portal, so
 * pulling libphonenumber-js metadata in here would land it in every consumer's
 * initial bundle. Metadata-backed validation is layered on top by injecting
 * `isValidPhone` into `createRegisterRequestSchema` — see register.contract.ts.
 *
 * `+`, a non-zero leading digit, then up to 14 more digits (ITU-T E.164 caps
 * the subscriber number at 15 digits total).
 */
export const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const PhoneE164Schema = z
  .string()
  .regex(E164_REGEX, { error: "validation.phone.invalid" });

export type PhoneE164 = z.infer<typeof PhoneE164Schema>;
