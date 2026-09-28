ALTER TABLE "report_access_codes" DROP CONSTRAINT IF EXISTS "report_access_codes_agent_id_fkey";

DROP INDEX IF EXISTS "report_access_codes_agent_id_idx";

CREATE INDEX IF NOT EXISTS "report_access_codes_agent_id_created_at_idx"
ON "report_access_codes"("agent_id", "created_at");

ALTER TABLE "report_access_codes"
ADD CONSTRAINT "report_access_codes_agent_id_fkey"
FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
