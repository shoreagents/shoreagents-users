require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration - use the same as the main app
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function runMigration() {
  const pool = new Pool(databaseConfig);
  
  try {
    console.log('🔄 Running migration 076: Events real-time notifications...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '076_events_realtime_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 076 completed successfully!');
    console.log('📡 Real-time event notifications are now enabled');
    console.log('🔔 PostgreSQL triggers created for events and event_attendance tables');
    
  } catch (error) {
    console.error('❌ Migration 076 failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
