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
    console.log('🔄 Running migration 092: Add clinic timestamps...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '092_add_clinic_timestamps.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 092 completed successfully!');
    console.log('🏥 Clinic timestamp tracking implemented:');
    console.log('   - going_to_clinic_at: Tracks when agent clicked "Going to Clinic"');
    console.log('   - in_clinic_at: Tracks when nurse confirmed "In Clinic"');
    console.log('   - Automatic timestamps set when states become true');
    console.log('   - Indexes added for better query performance');
    
  } catch (error) {
    console.error('❌ Migration 092 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
