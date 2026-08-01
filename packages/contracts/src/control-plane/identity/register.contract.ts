import { z } from "zod";
import { PhoneE164Schema } from "../../shared/phone.contract";

const nameSchema = z.string().trim().min(2).max(80);
const passwordSchema = z.string().min(8).max(128);

const credentialsShape = {
  name: nameSchema,
  surname: nameSchema,
  password: passwordSchema,
  passwordConfirm: passwordSchema,
};

export interface CreateRegisterRequestSchemaOptions {
  /**
   * Metadata-backed E.164 validity check, layered on top of the structural
   * regex. Must be synchronous: nestjs-zod's ZodValidationPipe calls
   * `schema.parse()`, never `parseAsync`, so an async check would throw on
   * every request. The asynchrony belongs to *obtaining* this function, not to
   * calling it:
   *
   *   apps/api: import { isValidPhone } from "@repo/utils/phone";
   *   apps/web-portal: const { isValidPhone } = await import("@repo/utils/phone");
   *
   * Left undefined, only the regex in `PhoneE164Schema` runs.
   */
  isValidPhone?: (value: string) => boolean;
}

export function createRegisterRequestSchema(
  options: CreateRegisterRequestSchemaOptions = {},
) {
  const { isValidPhone } = options;

  const phoneSchema = isValidPhone
    ? PhoneE164Schema.refine(isValidPhone, {
        error: "validation.phone.invalid",
      })
    : PhoneE164Schema;

  return z
    .discriminatedUnion("method", [
      z.object({
        method: z.literal("email"),
        ...credentialsShape,
        email: z.email({ error: "validation.email.invalid" }),
      }),
      z.object({
        method: z.literal("phone"),
        ...credentialsShape,
        phone: phoneSchema,
      }),
    ])
    .check((ctx) => {
      if (ctx.value.password !== ctx.value.passwordConfirm) {
        ctx.issues.push({
          code: "custom",
          input: ctx.value.passwordConfirm,
          path: ["passwordConfirm"],
          message: "validation.password.mismatch",
        });
      }
    });
}

export const RegisterRequestSchema = createRegisterRequestSchema();

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
