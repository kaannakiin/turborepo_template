-- CreateEnum
CREATE TYPE "SessionClientType" AS ENUM ('WEB', 'MOBILE');

-- AlterTable
ALTER TABLE "user_sessions" ADD COLUMN     "clientType" "SessionClientType" NOT NULL DEFAULT 'WEB';
