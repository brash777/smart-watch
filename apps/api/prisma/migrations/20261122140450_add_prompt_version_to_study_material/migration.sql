/*
  Warnings:

  - Added the required column `prompt_version` to the `flashcard_decks` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prompt_version` to the `quizzes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ask_messages" ADD COLUMN     "prompt_version" TEXT;

-- AlterTable
ALTER TABLE "flashcard_decks" ADD COLUMN     "prompt_version" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "quizzes" ADD COLUMN     "prompt_version" TEXT NOT NULL;
