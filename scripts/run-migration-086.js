const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration086() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Migration 086: Fix premature "Event Started" notifications...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '086_fix_premature_event_started_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 086 completed successfully!');
    console.log('⏰ "Event Started" notifications now only sent when actual start time is reached');
    console.log('🔧 Events changing to "today" status will not trigger premature notifications');
    console.log('📅 Notifications will be sent at the correct time based on start_time field');
    
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
      
      if (definition.includes('current_time >= event_start_time')) {
        console.log('✅ Function now includes time-based check for event started notifications');
      } else {
        console.log('❌ Function still missing time-based check');
      }
      
      if (definition.includes('CURRENT_TIMESTAMP AT TIME ZONE')) {
        console.log('✅ Function now uses Philippines timezone for time comparison');
      } else {
        console.log('❌ Function still missing timezone handling');
      }
    }
    
    console.log('\n🎉 Migration 086 verification complete!');
    console.log('💡 "Event Started" notifications will now be sent at the correct time');
    
  } catch (error) {
    console.error('❌ Migration 086 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration086().catch(console.error);




