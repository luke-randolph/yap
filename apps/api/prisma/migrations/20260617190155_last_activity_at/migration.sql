/*
  Warnings:

  - You are about to drop the column `lastMessageAt` on the `Conversation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Conversation_lastMessageAt_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "lastMessageAt",
ADD COLUMN     "lastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Conversation_lastActivityAt_idx" ON "Conversation"("lastActivityAt");
