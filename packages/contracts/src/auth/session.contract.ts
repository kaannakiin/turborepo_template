import { z } from "zod";
import { RoleSchema } from "../shared/role.contract";

export const SessionSchema = z.object({
  userId: z.uuid(),
  email: z.email(),
  role: RoleSchema,
});

export type Session = z.infer<typeof SessionSchema>;
