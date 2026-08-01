import { z } from "zod";
import type { UserModel } from "@repo/database/models";
import { PlatformRoleSchema } from "../../shared/platform-role.contract";

export const UserSchema = z.object({
  // publicId, never the BigInt row id — database ids do not cross the wire.
  publicId: z.cuid2(),
  // Nullable since phone-only registration: users.email is NULLable in the DB.
  email: z.email({ error: "validation.email.invalid" }).nullable(),
  name: z.string().min(1).max(80),
  surname: z.string().min(1).max(80),
  platformRole: PlatformRoleSchema,
  createdAt: z.iso.datetime(),
});

// Admin-created users still require an email even though the column is
// nullable — phone-only accounts come exclusively through self-registration.
export const CreateUserSchema = UserSchema.pick({
  name: true,
  surname: true,
}).extend({
  email: z.email({ error: "validation.email.invalid" }),
  password: z.string().min(8).max(128),
  platformRole: PlatformRoleSchema.optional(),
});

// Password changes go through the auth flows, not admin PATCH.
export const UpdateUserSchema = CreateUserSchema.omit({
  password: true,
}).partial();

export const UserListSchema = z.array(UserSchema);

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

type Expect<T extends true> = T;

export type UserContractMatchesPrisma = Expect<
  Exclude<keyof User, keyof UserModel> extends never
    ? [User["platformRole"]] extends [UserModel["platformRole"]]
      ? [UserModel["platformRole"]] extends [User["platformRole"]]
        ? true
        : false
      : false
    : false
>;
