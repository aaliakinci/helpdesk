BEGIN;

DROP INDEX IF EXISTS "tickets_tenant_subject_trgm_idx";
DROP INDEX IF EXISTS "tickets_tenant_description_trgm_idx";
DROP INDEX IF EXISTS "customers_tenant_name_trgm_idx";
DROP INDEX IF EXISTS "customer_contacts_tenant_display_name_trgm_idx";
DROP INDEX IF EXISTS "customer_contacts_tenant_email_trgm_idx";
DROP INDEX IF EXISTS "tags_tenant_name_trgm_idx";

CREATE INDEX "tickets_tenant_subject_trgm_idx"
  ON "tickets" USING GIN ("tenant_id", "subject" gin_trgm_ops);
CREATE INDEX "tickets_tenant_description_trgm_idx"
  ON "tickets" USING GIN ("tenant_id", "description" gin_trgm_ops);
CREATE INDEX "customers_tenant_name_trgm_idx"
  ON "customers" USING GIN ("tenant_id", "name" gin_trgm_ops);
CREATE INDEX "customer_contacts_tenant_display_name_trgm_idx"
  ON "customer_contacts" USING GIN ("tenant_id", "display_name" gin_trgm_ops);
CREATE INDEX "customer_contacts_tenant_email_trgm_idx"
  ON "customer_contacts" USING GIN ("tenant_id", "email" gin_trgm_ops);
CREATE INDEX "tags_tenant_name_trgm_idx"
  ON "tags" USING GIN ("tenant_id", "name" gin_trgm_ops);

COMMIT;
