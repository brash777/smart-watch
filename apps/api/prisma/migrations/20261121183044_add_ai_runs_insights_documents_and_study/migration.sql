-- CreateEnum
CREATE TYPE "ai_task" AS ENUM ('SNAP_ANALYSIS', 'COMPOSE_DOCUMENT', 'STUDY_FLASHCARDS', 'STUDY_QUIZ', 'ASK_SPACE', 'POST_DRAFT');

-- CreateEnum
CREATE TYPE "ai_run_status" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('STUDY_NOTES', 'STUDY_SUMMARY', 'ASSIGNMENT_GUIDE', 'WORK_DAILY_REPORT', 'WORK_PROGRESS_REPORT', 'CONTENT_POST', 'CONTENT_CAROUSEL');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "ask_message_role" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "space_id" UUID,
    "task" "ai_task" NOT NULL,
    "status" "ai_run_status" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "estimated_cost" DECIMAL(12,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snap_insights" (
    "id" UUID NOT NULL,
    "snap_id" UUID NOT NULL,
    "mode" "space_mode" NOT NULL,
    "summary" TEXT NOT NULL,
    "extracted_text" TEXT,
    "data" JSONB NOT NULL,
    "ai_run_id" UUID,
    "edited_by_user" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snap_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" "document_type" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "content_markdown" TEXT NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "ai_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sources" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "snap_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard_decks" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "source_document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcard_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcards" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "source_snap_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" TEXT[],
    "correct_index" INTEGER NOT NULL,
    "explanation" TEXT,
    "source_snap_id" UUID,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempts" (
    "id" UUID NOT NULL,
    "quiz_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "answers" INTEGER[],
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ask_messages" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "ask_message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "cited_snap_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "ai_run_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ask_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_created_at_task_idx" ON "ai_runs"("created_at", "task");

-- CreateIndex
CREATE INDEX "ai_runs_user_id_idx" ON "ai_runs"("user_id");

-- CreateIndex
CREATE INDEX "ai_runs_space_id_idx" ON "ai_runs"("space_id");

-- CreateIndex
CREATE UNIQUE INDEX "snap_insights_snap_id_key" ON "snap_insights"("snap_id");

-- CreateIndex
CREATE INDEX "snap_insights_ai_run_id_idx" ON "snap_insights"("ai_run_id");

-- CreateIndex
CREATE INDEX "documents_space_id_type_idx" ON "documents"("space_id", "type");

-- CreateIndex
CREATE INDEX "documents_author_id_idx" ON "documents"("author_id");

-- CreateIndex
CREATE INDEX "documents_ai_run_id_idx" ON "documents"("ai_run_id");

-- CreateIndex
CREATE INDEX "document_sources_snap_id_idx" ON "document_sources"("snap_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_sources_document_id_snap_id_key" ON "document_sources"("document_id", "snap_id");

-- CreateIndex
CREATE INDEX "flashcard_decks_space_id_idx" ON "flashcard_decks"("space_id");

-- CreateIndex
CREATE INDEX "flashcard_decks_author_id_idx" ON "flashcard_decks"("author_id");

-- CreateIndex
CREATE INDEX "flashcard_decks_source_document_id_idx" ON "flashcard_decks"("source_document_id");

-- CreateIndex
CREATE INDEX "flashcards_deck_id_sort_order_idx" ON "flashcards"("deck_id", "sort_order");

-- CreateIndex
CREATE INDEX "flashcards_source_snap_id_idx" ON "flashcards"("source_snap_id");

-- CreateIndex
CREATE INDEX "quizzes_space_id_idx" ON "quizzes"("space_id");

-- CreateIndex
CREATE INDEX "quizzes_author_id_idx" ON "quizzes"("author_id");

-- CreateIndex
CREATE INDEX "quiz_questions_quiz_id_sort_order_idx" ON "quiz_questions"("quiz_id", "sort_order");

-- CreateIndex
CREATE INDEX "quiz_questions_source_snap_id_idx" ON "quiz_questions"("source_snap_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_quiz_id_user_id_idx" ON "quiz_attempts"("quiz_id", "user_id");

-- CreateIndex
CREATE INDEX "quiz_attempts_user_id_idx" ON "quiz_attempts"("user_id");

-- CreateIndex
CREATE INDEX "ask_messages_space_id_user_id_created_at_idx" ON "ask_messages"("space_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "ask_messages_ai_run_id_idx" ON "ask_messages"("ai_run_id");

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_insights" ADD CONSTRAINT "snap_insights_snap_id_fkey" FOREIGN KEY ("snap_id") REFERENCES "snaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "snap_insights" ADD CONSTRAINT "snap_insights_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sources" ADD CONSTRAINT "document_sources_snap_id_fkey" FOREIGN KEY ("snap_id") REFERENCES "snaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard_decks" ADD CONSTRAINT "flashcard_decks_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "flashcard_decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_source_snap_id_fkey" FOREIGN KEY ("source_snap_id") REFERENCES "snaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_source_snap_id_fkey" FOREIGN KEY ("source_snap_id") REFERENCES "snaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ask_messages" ADD CONSTRAINT "ask_messages_ai_run_id_fkey" FOREIGN KEY ("ai_run_id") REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
