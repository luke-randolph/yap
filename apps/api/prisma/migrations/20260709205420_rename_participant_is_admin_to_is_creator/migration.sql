/*
  Warnings:

  - You are about to drop the column `isAdmin` on the `ConversationParticipant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ConversationParticipant" DROP COLUMN "isAdmin",
ADD COLUMN     "isCreator" BOOLEAN NOT NULL DEFAULT false;
