const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Running migration 091: Implement clinic workflow automation...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '091_implement_clinic_workflow_automation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 091 completed successfully!');
    console.log('🏥 Clinic workflow automation implemented:');
    console.log('   - When in_clinic is set to true, going_to_clinic automatically becomes false');
    console.log('   - When done is set to true, in_clinic automatically becomes false');
    
  } catch (error) {
    console.error('❌ Migration 091 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
