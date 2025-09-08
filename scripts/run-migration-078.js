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
    console.log('🚀 Running migration 078: Fix duplicate available_soon notifications...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '078_fix_duplicate_available_soon_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 078 completed successfully!');
    console.log('📝 Fixed duplicate "available soon" notifications by:');
    console.log('   - Checking if available_soon notification was already sent today for the same break type');
    console.log('   - Using proper timezone handling for duplicate detection');
    console.log('   - Preventing multiple notifications within the same day for the same break');
    
  } catch (error) {
    console.error('❌ Migration 078 failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
