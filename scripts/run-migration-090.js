const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🚀 Running migration 090: Add health check field update function...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '090_add_health_check_field_update_function.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 090 completed successfully!');
    console.log('📋 Added:');
    console.log('  - notify_health_check_field_update() function');
    console.log('  - trigger_health_check_field_update() function');
    console.log('  - health_check_field_update_trigger trigger');
    
  } catch (error) {
    console.error('❌ Migration 090 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
