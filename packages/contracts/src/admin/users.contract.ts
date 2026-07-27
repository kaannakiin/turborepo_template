import { z } from "zod";
import type { UserModel } from "@repo/database/models";
import { RoleSchema } from "../shared/role.contract";

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email({ error: "validation.email.invalid" }),
  name: z.string().min(1).max(120),
  role: RoleSchema,
  createdAt: z.iso.datetime(),
});

export const CreateUserSchema = UserSchema.pick({
  email: true,
  name: true,
}).extend({
  role: RoleSchema.optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UserListSchema = z.array(UserSchema);

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

type Expect<T extends true> = T;

export type UserContractMatchesPrisma = Expect<
  Exclude<keyof User, keyof UserModel> extends never
    ? [User["role"]] extends [UserModel["role"]]
      ? [UserModel["role"]] extends [User["role"]]
        ? true
        : false
      : false
    : false
>;
