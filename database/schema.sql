-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('created', 'a_in_progress', 'a_completed', 'b_in_progress', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "UnlockType" AS ENUM ('FULL_RESULT', 'RELATION_CARD', 'PERSONAL_DETAIL', 'ADVANCED_RESULT', 'SPECIAL_BADGE');

-- CreateEnum
CREATE TYPE "UnlockStatus" AS ENUM ('granted', 'revoked');

-- CreateEnum
CREATE TYPE "AdSessionStatus" AS ENUM ('started', 'consumed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "login_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "scene_label" TEXT NOT NULL,
    "stem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score_vector" JSONB NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "participant_b_id" TEXT,
    "invite_code" TEXT NOT NULL,
    "status" "TestStatus" NOT NULL DEFAULT 'created',
    "question_version" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_answers" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personality_results" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "personality_type" TEXT NOT NULL,
    "secondary_type" TEXT,
    "dimension_scores" JSONB NOT NULL,
    "type_scores" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personality_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationship_results" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "indices" JSONB NOT NULL,
    "who_more" JSONB NOT NULL,
    "scene" JSONB NOT NULL,
    "roast" TEXT NOT NULL,
    "advice" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_unlocks" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "unlock_type" "UnlockType" NOT NULL,
    "unlock_status" "UnlockStatus" NOT NULL DEFAULT 'granted',
    "ad_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_access_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "price_fen" INTEGER NOT NULL,
    "price_variant" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "redeemed_test_id" TEXT,
    "redeemed_by_id" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_sessions" (
    "id" TEXT NOT NULL,
    "test_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nonce_hash" TEXT NOT NULL,
    "status" "AdSessionStatus" NOT NULL DEFAULT 'started',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "ad_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_records" (
    "id" TEXT NOT NULL,
    "test_id" TEXT,
    "user_id" TEXT NOT NULL,
    "share_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "test_id" TEXT,
    "event_name" TEXT NOT NULL,
    "properties" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_login_key_key" ON "users"("login_key");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "questions_version_sort_order_idx" ON "questions"("version", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_question_id_key_key" ON "question_options"("question_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "tests_invite_code_key" ON "tests"("invite_code");

-- CreateIndex
CREATE INDEX "tests_creator_id_idx" ON "tests"("creator_id");

-- CreateIndex
CREATE INDEX "tests_participant_b_id_idx" ON "tests"("participant_b_id");

-- CreateIndex
CREATE INDEX "tests_status_idx" ON "tests"("status");

-- CreateIndex
CREATE INDEX "test_answers_test_id_user_id_idx" ON "test_answers"("test_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_answers_test_id_user_id_question_id_key" ON "test_answers"("test_id", "user_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "personality_results_test_id_user_id_key" ON "personality_results"("test_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_results_test_id_key" ON "relationship_results"("test_id");

-- CreateIndex
CREATE INDEX "result_unlocks_user_id_idx" ON "result_unlocks"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "result_unlocks_test_id_user_id_unlock_type_key" ON "result_unlocks"("test_id", "user_id", "unlock_type");

-- CreateIndex
CREATE UNIQUE INDEX "report_access_codes_code_key" ON "report_access_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "report_access_codes_redeemed_test_id_key" ON "report_access_codes"("redeemed_test_id");

-- CreateIndex
CREATE INDEX "report_access_codes_channel_price_variant_idx" ON "report_access_codes"("channel", "price_variant");

-- CreateIndex
CREATE INDEX "ad_sessions_nonce_hash_idx" ON "ad_sessions"("nonce_hash");

-- CreateIndex
CREATE INDEX "ad_sessions_test_id_user_id_idx" ON "ad_sessions"("test_id", "user_id");

-- CreateIndex
CREATE INDEX "share_records_share_type_created_at_idx" ON "share_records"("share_type", "created_at");

-- CreateIndex
CREATE INDEX "events_event_name_created_at_idx" ON "events"("event_name", "created_at");

-- CreateIndex
CREATE INDEX "events_test_id_idx" ON "events"("test_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_answers" ADD CONSTRAINT "test_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personality_results" ADD CONSTRAINT "personality_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personality_results" ADD CONSTRAINT "personality_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationship_results" ADD CONSTRAINT "relationship_results_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_unlocks" ADD CONSTRAINT "result_unlocks_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_unlocks" ADD CONSTRAINT "result_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_access_codes" ADD CONSTRAINT "report_access_codes_redeemed_test_id_fkey" FOREIGN KEY ("redeemed_test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_access_codes" ADD CONSTRAINT "report_access_codes_redeemed_by_id_fkey" FOREIGN KEY ("redeemed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sessions" ADD CONSTRAINT "ad_sessions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_sessions" ADD CONSTRAINT "ad_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_records" ADD CONSTRAINT "share_records_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_records" ADD CONSTRAINT "share_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
