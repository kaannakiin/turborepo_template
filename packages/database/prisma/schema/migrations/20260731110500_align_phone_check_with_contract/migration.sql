-- The previous migration's CHECK required at least 8 digits, which is stricter
-- than E164_REGEX in @repo/contracts/shared. The API would have accepted a
-- shorter number and then failed on INSERT with a 500 instead of a 400. The
-- database must not be stricter than the contract it stores.
ALTER TABLE "users" DROP CONSTRAINT "users_phone_e164";

ALTER TABLE "users" ADD CONSTRAINT "users_phone_e164"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{1,14}$');
