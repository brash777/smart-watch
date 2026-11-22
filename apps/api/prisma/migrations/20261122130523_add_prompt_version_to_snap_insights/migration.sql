/*
  Warnings:

  - Added the required column `prompt_version` to the `snap_insights` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "snap_insights" ADD COLUMN     "prompt_version" TEXT NOT NULL;
