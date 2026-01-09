#!/usr/bin/env node
// Simple RLS verification script for CI/local runs.
// Exits with non-zero code if any flagged policy is still permissive.

const { Client } = require('pg');

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  console.log('Skipping RLS check: SUPABASE_DB_URL or DATABASE_URL is not set');
  process.exit(0);
}

const client = new Client({ connectionString: DB_URL });

const FLAGGED_TABLES = [
  'csrf_tokens',
  'order_items',
  'page_views',
  'payments',
  'security_logs',
  'sessions',
  'site_settings'
];

(async () => {
  await client.connect();

  const res = await client.query(`
    select schemaname, tablename, policyname, cmd, coalesce(with_check::text, '') as with_check, coalesce(using::text, '') as using
    from pg_policies
    where tablename = any($1)
  `, [FLAGGED_TABLES]);

  const problems = [];

  for (const row of res.rows) {
    const cmd = (row.cmd || '').toLowerCase();
    const using = (row.using || '').trim().toLowerCase();
    const with_check = (row.with_check || '').trim().toLowerCase();

    // We only flag INSERT/UPDATE/DELETE policies that have trivially permissive predicates
    if (['insert','update','delete'].includes(cmd)) {
      if (using === 'true' || with_check === 'true' || using === '' && with_check === 'true') {
        problems.push({ table: row.tablename, policy: row.policyname, cmd, using, with_check });
      }
    }
  }

  if (problems.length) {
    console.error('\n❌ RLS verification failed: found permissive policies on flagged tables:\n');
    for (const p of problems) {
      console.error(`- ${p.table} :: ${p.policy} (cmd=${p.cmd}) using='${p.using}' with_check='${p.with_check}')`);
    }
    await client.end();
    process.exit(2);
  }

  console.log('✅ RLS verification passed for flagged tables.');
  await client.end();
  process.exit(0);
})();
