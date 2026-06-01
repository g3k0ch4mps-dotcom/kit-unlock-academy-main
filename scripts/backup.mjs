/**
 * Mamuza DB Backup Script
 *
 * Exports all public table data to a timestamped JSON backup folder.
 * Run: node scripts/backup.mjs
 *
 * Requires env vars:
 *   SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 *
 * The service role key bypasses RLS so all data is exported.
 * Find it in: Supabase Dashboard → Settings → API → service_role key
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
  console.error(
    "Example: SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/backup.mjs"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Tables in dependency order (parents before children)
// auth.users is managed separately via Supabase dashboard export
const TABLES = [
  // Content catalog — no user deps
  "kits",
  "programs",
  "sessions",
  "content_blocks",
  "session_quizzes",
  "program_tests",
  "projects",
  "badges",
  "store_items",
  // User data — requires auth.users to exist on restore
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

async function exportTable(table) {
  let allRows = [];
  let from = 0;
  const batchSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + batchSize - 1);

    if (error) {
      console.warn(`  WARNING: Could not export ${table}: ${error.message}`);
      return [];
    }

    if (!data || data.length === 0) break;

    allRows = allRows.concat(data);

    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(process.cwd(), "backups", `backup-${timestamp}`);

  mkdirSync(backupDir, { recursive: true });
  console.log(`Backup directory: ${backupDir}\n`);

  const manifest = {
    created_at: new Date().toISOString(),
    supabase_url: SUPABASE_URL,
    tables: {},
  };

  for (const table of TABLES) {
    process.stdout.write(`Exporting ${table}... `);
    const rows = await exportTable(table);
    const filePath = join(backupDir, `${table}.json`);
    writeFileSync(filePath, JSON.stringify(rows, null, 2));
    manifest.tables[table] = rows.length;
    console.log(`${rows.length} rows`);
  }

  writeFileSync(
    join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log("\nBackup complete.");
  console.log(
    "IMPORTANT: Also export your auth users from Supabase Dashboard:"
  );
  console.log("  Authentication → Users → Export CSV");
  console.log(`  Save as: ${backupDir}/auth_users.csv`);
}

main().catch((err) => {
  console.error("Backup failed:", err.message);
  process.exit(1);
});
