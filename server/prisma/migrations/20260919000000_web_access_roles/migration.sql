CREATE TYPE "AccessRole" AS ENUM ('buyer', 'guest');

ALTER TABLE "users"
ADD COLUMN "access_role" "AccessRole" NOT NULL DEFAULT 'buyer',
ADD COLUMN "access_code_id" TEXT;

ALTER TABLE "tests"
ADD COLUMN "purchase_access_code_id" TEXT;

CREATE INDEX "users_access_code_id_idx" ON "users"("access_code_id");
CREATE INDEX "tests_purchase_access_code_id_idx" ON "tests"("purchase_access_code_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_access_code_id_fkey"
FOREIGN KEY ("access_code_id") REFERENCES "report_access_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tests"
ADD CONSTRAINT "tests_purchase_access_code_id_fkey"
FOREIGN KEY ("purchase_access_code_id") REFERENCES "report_access_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
