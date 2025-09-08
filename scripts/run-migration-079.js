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
    console.log('🚀 Running migration 079: Fix meeting and activity conflict...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '079_fix_meeting_activity_conflict.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 079 completed successfully!');
    console.log('📝 Fixed meeting and activity conflict by:');
    console.log('   - Adding activity/event check to start_meeting function');
    console.log('   - Preventing meetings from starting when user is in activity/event');
    console.log('   - Providing clear error messages about the conflict');
    console.log('   - Maintaining existing meeting start logic for valid cases');
    
  } catch (error) {
    console.error('❌ Migration 079 failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
