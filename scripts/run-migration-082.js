const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('🚀 Running migration 082: Fix meeting scheduler infinite loop...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '082_fix_meeting_scheduler_infinite_loop.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 082 completed successfully!');
    console.log('📋 Changes made:');
    console.log('   • Updated check_and_start_scheduled_meetings function');
    console.log('   • Added pre-check for user event status before attempting to start meetings');
    console.log('   • Improved logging to distinguish between expected skips and actual errors');
    console.log('   • This should fix the infinite API call loop when user is in an event');
    
  } catch (error) {
    console.error('❌ Migration 082 failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
