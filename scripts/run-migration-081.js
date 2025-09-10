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
    console.log('🚀 Running migration 081: Fix activity started notification...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '081_fix_activity_started_notification.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 081 completed successfully!');
    console.log('📝 Fixed activity started notification by:');
    console.log('   - Removed premature "Activity Started" notifications from database trigger');
    console.log('   - Notifications now only sent when start time has actually passed');
    console.log('   - Event reminder scheduler handles "started" notifications correctly');
    console.log('   - Database trigger only handles "cancelled" and "ended" notifications');
    
  } catch (error) {
    console.error('❌ Migration 081 failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
