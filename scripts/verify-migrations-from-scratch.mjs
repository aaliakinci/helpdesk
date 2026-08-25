import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import pg from "pg";

const configuredUrl = process.env.DATABASE_URL;
if (!configuredUrl) throw new Error("DATABASE_URL is required for migration verification.");
const sourceUrl = new URL(configuredUrl);
if (sourceUrl.protocol !== "postgres:" && sourceUrl.protocol !== "postgresql:") {
  throw new Error("Migration verification requires PostgreSQL.");
}

const scratchName = `helpdesk_migration_verify_${process.pid}`;
const expectedMigrationCount = (
  await readdir(new URL("../src/server/prisma/migrations/", import.meta.url), {
    withFileTypes: true,
  })
).filter((entry) => entry.isDirectory()).length;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
adminUrl.search = "";
const scratchUrl = new URL(sourceUrl);
scratchUrl.pathname = `/${scratchName}`;
scratchUrl.searchParams.set("schema", "public");
const admin = new pg.Client({ connectionString: adminUrl.toString() });
let created = false;

await admin.connect();
try {
  await admin.query(`CREATE DATABASE ${quoteIdentifier(scratchName)}`);
  created = true;
  const migration = spawnSync("npm", ["run", "db:migrate:deploy"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
    maxBuffer: 8 * 1024 * 1024,
  });
  if (migration.status !== 0) {
    throw new Error(`Fresh migration failed:\n${migration.stdout}\n${migration.stderr}`);
  }

  const scratch = new pg.Client({ connectionString: scratchUrl.toString() });
  await scratch.connect();
  try {
    const state = await scratch.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL) AS "migration_count",
        (SELECT COUNT(*)::int FROM pg_indexes WHERE indexname IN ('tickets_tenant_subject_trgm_idx', 'audit_entries_tenant_action_occurred_idx')) AS "index_count",
        (SELECT COUNT(*)::int FROM information_schema.columns WHERE table_name = 'attachments' AND column_name IN ('checksum_sha256', 'comment_id', 'visibility')) AS "attachment_column_count"
    `);
    expectEqual(state.rows[0]?.migration_count, expectedMigrationCount, "migration count");
    expectEqual(state.rows[0]?.index_count, 2, "qualified index count");
    expectEqual(state.rows[0]?.attachment_column_count, 3, "attachment column count");
  } finally {
    await scratch.end();
  }
  process.stdout.write("Fresh PostgreSQL migration verification passed.\n");
} finally {
  if (created) {
    await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [
      scratchName,
    ]);
    await admin.query(`DROP DATABASE ${quoteIdentifier(scratchName)}`);
  }
  await admin.end();
}

function expectEqual(actual, expected, name) {
  if (actual !== expected) throw new Error(`${name} was ${actual}; expected ${expected}.`);
}

function quoteIdentifier(value) {
  if (!/^helpdesk_migration_verify_[0-9]+$/u.test(value)) {
    throw new Error("Scratch database name is invalid.");
  }
  return `"${value}"`;
}
