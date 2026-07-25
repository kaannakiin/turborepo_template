import { z } from "zod";

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120),
  createdAt: z.iso.datetime(),
});

export const CreateUserSchema = UserSchema.pick({
  email: true,
  name: true,
});

export const UserListSchema = z.array(UserSchema);

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
