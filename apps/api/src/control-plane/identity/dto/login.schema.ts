import { createLoginRequestSchema } from "@repo/contracts/control-plane/identity";
import { isValidPhone } from "@repo/utils/phone";

// No createZodDto class on purpose: login bodies are validated by
// LocalAuthGuard/LocalStrategy, which run before the global pipe ever could.
export const loginRequestSchema = createLoginRequestSchema({ isValidPhone });
