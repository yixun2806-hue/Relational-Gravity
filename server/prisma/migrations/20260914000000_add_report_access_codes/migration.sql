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

CREATE UNIQUE INDEX "report_access_codes_code_key" ON "report_access_codes"("code");
CREATE UNIQUE INDEX "report_access_codes_redeemed_test_id_key" ON "report_access_codes"("redeemed_test_id");
CREATE INDEX "report_access_codes_channel_price_variant_idx" ON "report_access_codes"("channel", "price_variant");

ALTER TABLE "report_access_codes" ADD CONSTRAINT "report_access_codes_redeemed_test_id_fkey"
FOREIGN KEY ("redeemed_test_id") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "report_access_codes" ADD CONSTRAINT "report_access_codes_redeemed_by_id_fkey"
FOREIGN KEY ("redeemed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
