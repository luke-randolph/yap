-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('user', 'system');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "type" "MessageType" NOT NULL DEFAULT 'user';
