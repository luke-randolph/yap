/*
  Warnings:

  - You are about to drop the column `requestPending` on the `ConversationParticipant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "requestPending" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConversationParticipant" DROP COLUMN "requestPending";
