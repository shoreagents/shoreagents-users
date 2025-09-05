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
    console.log('🔄 Running migration 073: Fix night shift activity date calculation');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '073_fix_night_shift_activity_date.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 073 completed successfully');
    
    // Test the function with user 4's shift
    console.log('🧪 Testing the function with user 4...');
    const testResult = await pool.query('SELECT get_activity_date_for_shift_simple(4) as activity_date');
    console.log('📅 Activity date for user 4:', testResult.rows[0].activity_date);
    
  } catch (error) {
    console.error('❌ Migration 073 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
