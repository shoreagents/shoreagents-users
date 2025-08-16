#!/usr/bin/env node
/*
 Run a SQL file against the configured DATABASE_URL using node-postgres.
 Usage:
   node scripts/run-sql.js migrations/030_realtime_notifications.sql
*/
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const { Client } = require('pg');

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('❌ Please provide a SQL file path.');
    console.error('   Example: node scripts/run-sql.js migrations/030_realtime_notifications.sql');
    process.exit(1);
  }

  const sqlPath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ SQL file not found: ${sqlPath}`);
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set. Please configure it in .env.local');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log(`🔄 Executing SQL from ${fileArg}`);
    await client.connect();
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ SQL executed successfully.');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('❌ SQL execution failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();


