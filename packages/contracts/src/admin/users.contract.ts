import { z } from "zod";
import type { UserModel } from "@repo/database/models";
import { RoleSchema } from "../shared/role.contract";

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120),
  role: RoleSchema,
  // Wire type, not DB type: Prisma hands back a `Date`, JSON carries a string.
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

/**
 * Compile-time parity guard — the reason `@repo/database/models` is imported
 * here at all. It asserts two things and nothing more:
 *
 *   1. every field this contract exposes still exists on the Prisma model,
 *   2. the `role` union is exactly the one Prisma generates.
 *
 * It deliberately does NOT assert `User extends UserModel`. The contract is the
 * *wire* type (`createdAt` is an ISO string); the model is the *DB* type
 * (`createdAt` is a `Date`). Conversion belongs in the API layer.
 */
export type UserContractMatchesPrisma = Expect<
  Exclude<keyof User, keyof UserModel> extends never
    ? [User["role"]] extends [UserModel["role"]]
      ? [UserModel["role"]] extends [User["role"]]
        ? true
        : false
      : false
    : false
>;
