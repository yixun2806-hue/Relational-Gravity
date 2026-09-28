ALTER TABLE "report_access_codes"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "use_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_used_at" TIMESTAMP(3);

CREATE INDEX "report_access_codes_is_active_created_at_idx"
ON "report_access_codes"("is_active", "created_at");
