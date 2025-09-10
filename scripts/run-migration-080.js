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
    console.log('🚀 Running migration 080: Fix event status logic...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '080_fix_event_status_logic.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 080 completed successfully!');
    console.log('📝 Fixed event status logic by:');
    console.log('   - Moving events from "upcoming" to "today" when event_date is today (regardless of start_time)');
    console.log('   - Moving events from "today" to "ended" when they pass their end_time on the same day');
    console.log('   - Moving events from "upcoming" to "ended" when event_date is in the past');
    console.log('   - Added update_all_event_statuses() function for comprehensive status updates');
    
    // Test the new function
    console.log('🧪 Testing the new event status update function...');
    const testResult = await pool.query('SELECT * FROM update_all_event_statuses()');
    console.log('📊 Test result:', testResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Migration 080 failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
