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
    console.log('🔄 Running migration 093: Update health check notifications with timestamps...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '093_update_health_check_notifications_with_timestamps.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 093 completed successfully!');
    console.log('🔔 Health check notifications updated:');
    console.log('   - going_to_clinic_at included in real-time notifications');
    console.log('   - in_clinic_at included in real-time notifications');
    console.log('   - Frontend will receive timestamp data for tracking');
    
  } catch (error) {
    console.error('❌ Migration 093 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
