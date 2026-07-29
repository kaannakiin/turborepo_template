-- Required by users.email (CITEXT). Prisma emits the column type but never the
-- extension, so this has to stay ahead of every CREATE TABLE below.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'BOT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SessionRevokeReason" AS ENUM ('USER_LOGOUT', 'USER_REVOKED_SESSION', 'USER_REVOKED_ALL', 'PASSWORD_CHANGED', 'TOKEN_REUSE_DETECTED', 'ADMIN_REVOKED');

-- CreateEnum
CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" VARCHAR(20),
    "passwordHash" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "phoneVerifiedAt" TIMESTAMPTZ(3),
    "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "userId" BIGINT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "displayName" VARCHAR(120),
    "deviceType" "DeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "osName" VARCHAR(64),
    "osVersion" VARCHAR(32),
    "browserName" VARCHAR(64),
    "browserVersion" VARCHAR(32),
    "firstSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" BIGSERIAL NOT NULL,
    "publicId" VARCHAR(24) NOT NULL,
    "userId" BIGINT NOT NULL,
    "deviceId" BIGINT,
    "familyId" UUID NOT NULL,
    "refreshTokenHash" BYTEA NOT NULL,
    "previousTokenHash" BYTEA,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" INET NOT NULL,
    "userAgent" TEXT,
    "countryCode" CHAR(2),
    "region" VARCHAR(96),
    "city" VARCHAR(96),
    "timezone" VARCHAR(64),
    "latitude" DECIMAL(8,5),
    "longitude" DECIMAL(8,5),
    "asn" INTEGER,
    "isp" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revokeReason" "SessionRevokeReason",

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "target" VARCHAR(320) NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "ipAddress" INET,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_publicId_key" ON "user_devices"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_fingerprint_key" ON "user_devices"("userId", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_publicId_key" ON "user_sessions"("publicId");

-- CreateIndex
CREATE INDEX "user_sessions_previousTokenHash_idx" ON "user_sessions"("previousTokenHash");

-- CreateIndex
CREATE INDEX "user_sessions_userId_lastUsedAt_idx" ON "user_sessions"("userId", "lastUsedAt" DESC);

-- CreateIndex
CREATE INDEX "user_sessions_familyId_idx" ON "user_sessions"("familyId");

-- CreateIndex
CREATE INDEX "user_sessions_deviceId_idx" ON "user_sessions"("deviceId");

-- CreateIndex
CREATE INDEX "user_sessions_expiresAt_idx" ON "user_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refreshTokenHash_key" ON "user_sessions"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_purpose_idx" ON "auth_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "auth_tokens_expiresAt_idx" ON "auth_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
