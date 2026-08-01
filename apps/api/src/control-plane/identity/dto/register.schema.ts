import { createRegisterRequestSchema } from "@repo/contracts/control-plane/identity";
import { isValidPhone } from "@repo/utils/phone";

// No createZodDto class: a class cannot extend a constructor returning a
// discriminated union (TS2509), so the controller validates this schema with a
// param-scoped ZodValidationPipe instead. Node has no bundle-size constraint,
// so the metadata-backed phone validator is injected statically; apps/web-portal
// lazy-loads the same function.
export const registerRequestSchema = createRegisterRequestSchema({
  isValidPhone,
});
