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
    console.log('🔄 Running migration 066: Meeting notification functions...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '066_meeting_notification_functions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 066 completed successfully!');
    console.log('📋 Added functions:');
    console.log('   - send_meeting_reminder_notification()');
    console.log('   - send_meeting_start_notification()');
    console.log('   - check_meeting_notifications()');
    console.log('   - Performance indexes for meeting notifications');
    
    // Test the functions
    console.log('\n🧪 Testing meeting notification functions...');
    
    const testResult = await pool.query('SELECT check_meeting_notifications()');
    console.log('Test result:', testResult.rows[0].check_meeting_notifications);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();