const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration084() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Migration 084: Add action URLs to event notifications...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '084_add_event_notification_action_urls.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 084 completed successfully!');
    console.log('🔗 Event notifications now include action URLs for proper navigation');
    console.log('🎯 Clicking on event notifications will now redirect to /status/events');
    
    // Verify the function was updated
    console.log('\n🔍 Verifying function update...');
    
    const verifyQuery = `
      SELECT 
        pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'notify_event_change'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;
    
    const result = await client.query(verifyQuery);
    if (result.rows.length > 0) {
      const definition = result.rows[0].definition;
      
      if (definition.includes('action_url')) {
        console.log('✅ Function now contains action_url in notification payloads');
      } else {
        console.log('❌ Function still missing action_url in payloads');
      }
      
      if (definition.includes('/status/events')) {
        console.log('✅ Function now includes /status/events action URL');
      } else {
        console.log('❌ Function still missing /status/events action URL');
      }
    }
    
    console.log('\n🎉 Migration 084 verification complete!');
    console.log('💡 Event notifications will now be clickable and redirect to the events page');
    
  } catch (error) {
    console.error('❌ Migration 084 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration084().catch(console.error);
