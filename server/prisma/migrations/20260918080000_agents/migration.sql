CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

ALTER TABLE "report_access_codes" ADD COLUMN "agent_id" TEXT;

CREATE INDEX "report_access_codes_agent_id_idx" ON "report_access_codes"("agent_id");

ALTER TABLE "report_access_codes"
ADD CONSTRAINT "report_access_codes_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
