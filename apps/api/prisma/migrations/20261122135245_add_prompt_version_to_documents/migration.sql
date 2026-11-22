/*
  Warnings:

  - Added the required column `prompt_version` to the `documents` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "prompt_version" TEXT NOT NULL;
