CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "system_settings" ("key", "value", "updated_at")
VALUES ('agent_low_stock_threshold', '30', CURRENT_TIMESTAMP);
