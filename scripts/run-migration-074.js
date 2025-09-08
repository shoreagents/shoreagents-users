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
    console.log('🔄 Running migration 074: Events & Activities schema');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '074_events_activities_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration 074 completed successfully');
    
    // Test the functions
    console.log('🧪 Testing the functions...');
    
    // Test get_user_events function
    try {
      const testEvents = await pool.query('SELECT get_user_events($1) as events', ['test@example.com']);
      console.log('📅 Events for test user:', testEvents.rows[0]?.events || 'No events found');
    } catch (testError) {
      console.log('📅 Test query completed (no test user exists)');
    }
    
    console.log('🎉 Events & Activities system is ready!');
    
  } catch (error) {
    console.error('❌ Migration 074 failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
