-- Hand-written in place of Prisma's DROP TYPE "Role" / CREATE TYPE
-- "PlatformRole" / DROP COLUMN "role": the column is the same platform-role
-- axis under a new name, and the generated form would discard it. ADD VALUE
-- ... BEFORE keeps the Postgres label order equal to the schema's, so the next
-- `migrate dev` diff stays empty.
ALTER TYPE "Role" RENAME TO "PlatformRole";
ALTER TYPE "PlatformRole" RENAME VALUE 'USER' TO 'NONE';
ALTER TYPE "PlatformRole" RENAME VALUE 'ADMIN' TO 'SUPERADMIN';
ALTER TYPE "PlatformRole" ADD VALUE 'SUPPORT' BEFORE 'SUPERADMIN';

-- AlterTable
ALTER TABLE "users" RENAME COLUMN "role" TO "platformRole";
ALTER TABLE "users" ALTER COLUMN "platformRole" SET DEFAULT 'NONE';

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "activeMembershipId" BIGINT;

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "membershipId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "grantedByMembershipId" BIGINT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "tenantId" BIGINT,
    "key" VARCHAR(48) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(240),
    "permissions" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_invitations" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "email" CITEXT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "invitedByMembershipId" BIGINT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "userId" BIGINT NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "joinedAt" TIMESTAMPTZ(3),
    "lastSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "slug" CITEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_assignments_tenantId_membershipId_idx" ON "role_assignments"("tenantId", "membershipId");

-- CreateIndex
CREATE INDEX "role_assignments_roleId_idx" ON "role_assignments"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_membershipId_roleId_key" ON "role_assignments"("membershipId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_publicId_key" ON "roles"("publicId");

-- CreateIndex
CREATE INDEX "roles_permissions_idx" ON "roles" USING GIN ("permissions");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenantId_key_key" ON "roles"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_publicId_key" ON "tenant_invitations"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_invitations_tokenHash_key" ON "tenant_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "tenant_invitations_tenantId_status_idx" ON "tenant_invitations"("tenantId", "status");

-- CreateIndex
CREATE INDEX "tenant_invitations_email_idx" ON "tenant_invitations"("email");

-- CreateIndex
CREATE INDEX "tenant_invitations_expiresAt_idx" ON "tenant_invitations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_publicId_key" ON "memberships"("publicId");

-- CreateIndex
CREATE INDEX "memberships_tenantId_status_idx" ON "memberships"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_tenantId_key" ON "memberships"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenantId_id_key" ON "memberships"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_publicId_key" ON "tenants"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "user_sessions_activeMembershipId_idx" ON "user_sessions"("activeMembershipId");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_activeMembershipId_fkey" FOREIGN KEY ("activeMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_tenantId_membershipId_fkey" FOREIGN KEY ("tenantId", "membershipId") REFERENCES "memberships"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invitedByMembershipId_fkey" FOREIGN KEY ("invitedByMembershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Everything below is hand-written: Prisma's schema language cannot express
-- CHECK constraints or partial indexes. All of it is purely additive — none of
-- these objects stands in for one Prisma manages, which is what keeps
-- `migrate dev` from reporting drift.

-- Both identifiers are nullable, so without this a row with neither can be
-- created and that account can never authenticate.
ALTER TABLE "users" ADD CONSTRAINT "users_email_or_phone_present"
  CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- users.phone is documented as E.164-normalized, and the unique constraint is
-- meaningless without it ("0555..." and "+90555..." would be two rows).
ALTER TABLE "users" ADD CONSTRAINT "users_phone_e164"
  CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{7,14}$');

-- tenants.slug is served as a DNS label.
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_slug_dns_label"
  CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$');

-- An empty permission key silently matches nothing instead of failing.
ALTER TABLE "roles" ADD CONSTRAINT "roles_permissions_no_blank"
  CHECK (NOT ('' = ANY("permissions")));

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");

ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_expiry_after_creation"
  CHECK ("expiresAt" > "createdAt");

-- roles_tenantId_key_key does not constrain system roles: Postgres treats
-- NULLs as distinct, so two rows with tenantId NULL and the same key would both
-- be accepted.
CREATE UNIQUE INDEX "roles_system_key_key"
  ON "roles" ("key") WHERE "tenantId" IS NULL;

-- One open invitation per address per tenant. Accepted, revoked and expired
-- rows are left unconstrained so the same address can be re-invited.
CREATE UNIQUE INDEX "tenant_invitations_pending_unique"
  ON "tenant_invitations" ("tenantId", "email") WHERE "status" = 'PENDING';
