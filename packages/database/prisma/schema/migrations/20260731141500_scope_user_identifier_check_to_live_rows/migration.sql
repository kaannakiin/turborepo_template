-- users_email_or_phone_present as first written rejected the soft delete in
-- UsersService.remove(), which nulls email and phone so the address can be
-- registered again (the unique constraints are global — see admin/user.prisma).
-- The invariant only ever meant to cover live rows: an account that can still
-- be signed into must carry at least one identifier. A tombstone must not.
ALTER TABLE "users" DROP CONSTRAINT "users_email_or_phone_present";

ALTER TABLE "users" ADD CONSTRAINT "users_email_or_phone_present"
  CHECK ("deletedAt" IS NOT NULL OR "email" IS NOT NULL OR "phone" IS NOT NULL);
