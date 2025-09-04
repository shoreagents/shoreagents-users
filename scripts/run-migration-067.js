const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

async function runMigration() {
  try {
    console.log('🔄 Running migration 067: Add meetings pagination...');
    
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', 'migrations', '067_add_meetings_pagination.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 067 completed successfully!');
    console.log('📊 Added pagination support to get_user_meetings function');
    console.log('📊 Added get_user_meetings_count function for pagination');
    
    // Test the functions
    console.log('\n🧪 Testing pagination functions...');
    
    const testResult = await pool.query('SELECT get_user_meetings_count(1, 7)');
    console.log('Test result (total count):', testResult.rows[0].get_user_meetings_count);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
