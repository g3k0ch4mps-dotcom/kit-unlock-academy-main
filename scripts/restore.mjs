/**
 * Mamuza DB Restore Script
 *
 * Restores a JSON backup into a target Supabase project.
 * Run: node scripts/restore.mjs ./backups/backup-2026-06-01T10-00-00
 *
 * Requires env vars pointing to the TARGET (new) Supabase project:
 *   SUPABASE_URL=https://NEW-PROJECT.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * BEFORE running this script:
 *   1. Create new Supabase project
 *   2. Run: supabase link --project-ref <new-project-ref>
 *   3. Run: supabase db push   (applies all migrations — schema + RLS)
 *   4. Recreate auth users via Supabase dashboard invite or bulk import
 *   5. Then run this script
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = process.argv[2];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!BACKUP_DIR) {
  console.error("Usage: node scripts/restore.mjs ./backups/backup-TIMESTAMP");
  process.exit(1);
}

const backupPath = resolve(BACKUP_DIR);
if (!existsSync(backupPath)) {
  console.error(`Backup directory not found: ${backupPath}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Restore order matches backup dependency order
const TABLES = [
  "kits",
  "programs",
  "sessions",
  "content_blocks",
  "session_quizzes",
  "program_tests",
  "projects",
  "badges",
  "store_items",
  "profiles",
  "user_roles",
  "user_devices",
  "user_program_access",
  "unlock_codes",
  "user_assessments",
  "personalized_content",
  "session_progress",
  "session_quiz_attempts",
  "test_attempts",
  "certificates",
  "user_xp",
  "xp_transactions",
  "user_streaks",
  "daily_logins",
  "user_badges",
  "redemptions",
];

async function restoreTable(table) {
  const filePath = join(backupPath, `${table}.json`);
  if (!existsSync(filePath)) {
    console.log(`  Skipping ${table} (no backup file found)`);
    return { inserted: 0, errors: 0 };
  }

  const rows = JSON.parse(readFileSync(filePath, "utf8"));
  if (rows.length === 0) {
    console.log(`  ${table}: empty, skipping`);
    return { inserted: 0, errors: 0 };
  }

  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.warn(`  WARNING ${table} batch ${i}-${i + batchSize}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += batch.length;
    }
  }

  return { inserted, errors };
}

async function main() {
  const manifestPath = join(backupPath, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    console.log(`Restoring backup from: ${manifest.created_at}`);
    console.log(`Original project: ${manifest.supabase_url}`);
    console.log(`Target project:   ${SUPABASE_URL}\n`);
  }

  console.log(
    "WARNING: This will upsert data into the target database. Existing rows with matching IDs will be overwritten."
  );
  console.log("Make sure auth.users exist in the target project before running.\n");

  const summary = {};

  for (const table of TABLES) {
    process.stdout.write(`Restoring ${table}... `);
    const result = await restoreTable(table);
    summary[table] = result;
    if (result.inserted > 0 || result.errors > 0) {
      console.log(`${result.inserted} inserted, ${result.errors} errors`);
    }
  }

  console.log("\nRestore complete.");

  const totalErrors = Object.values(summary).reduce((s, r) => s + r.errors, 0);
  if (totalErrors > 0) {
    console.warn(
      `\n${totalErrors} rows had errors — likely because referenced auth.users don't exist yet.`
    );
    console.warn("Create those users in Supabase Auth then re-run the script.");
  } else {
    console.log("All rows restored successfully.");
  }
}

main().catch((err) => {
  console.error("Restore failed:", err.message);
  process.exit(1);
});
