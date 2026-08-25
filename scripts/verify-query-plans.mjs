import "dotenv/config";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for query-plan verification.");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL enable_seqscan = off");
  // The deterministic seed is intentionally small; increase tuple cost only inside this
  // transaction so PostgreSQL demonstrates index eligibility for production-sized filtering.
  await client.query("SET LOCAL cpu_tuple_cost = 100");
  const tenant = await client.query('SELECT "id" FROM "tenants" ORDER BY "id" LIMIT 1');
  const tenantId = tenant.rows[0]?.id;
  if (!tenantId) throw new Error("At least one seeded tenant is required.");

  await assertPlanUses(
    'SELECT "id" FROM "tickets" WHERE "tenant_id" = $1 AND "subject" ILIKE $2',
    [tenantId, "%printer%"],
    "tickets_tenant_subject_trgm_idx",
  );
  await assertPlanUses(
    'SELECT "id" FROM "tickets" WHERE "tenant_id" = $1 AND "number" = $2',
    [tenantId, 1],
    "tickets_tenant_number_key",
  );
  await assertPlanUses(
    'SELECT "id" FROM "audit_entries" WHERE "tenant_id" = $1 AND "action" = $2 ORDER BY "occurred_at" DESC LIMIT 25',
    [tenantId, "ticket.created"],
    "audit_entries_tenant_action_occurred_idx",
  );
  await client.query("ROLLBACK");
  process.stdout.write("Query-plan verification passed for tenant search and audit indexes.\n");
} finally {
  await client.end();
}

async function assertPlanUses(statement, parameters, expectedIndex) {
  const result = await client.query(`EXPLAIN (FORMAT JSON) ${statement}`, parameters);
  const plan = result.rows[0]?.["QUERY PLAN"]?.[0]?.Plan;
  if (!plan || !containsIndex(plan, expectedIndex)) {
    throw new Error(`Query plan did not use ${expectedIndex}.`);
  }
}

function containsIndex(node, expectedIndex) {
  if (node["Index Name"] === expectedIndex) return true;
  return (
    Array.isArray(node.Plans) && node.Plans.some((child) => containsIndex(child, expectedIndex))
  );
}
