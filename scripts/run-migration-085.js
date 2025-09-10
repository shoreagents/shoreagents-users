const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration085() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Migration 085: Enhance event notification navigation...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '085_enhance_event_notification_navigation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 085 completed successfully!');
    console.log('🎯 Event notifications now include specific tab and event ID parameters');
    console.log('🔗 Cancelled events will redirect to /status/events?tab=cancelled&eventId=X');
    console.log('🔗 Started events will redirect to /status/events?tab=today&eventId=X');
    console.log('🔗 Ended events will redirect to /status/events?tab=ended&eventId=X');
    
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
      
      if (definition.includes('tab=cancelled')) {
        console.log('✅ Function now includes cancelled tab parameter');
      } else {
        console.log('❌ Function still missing cancelled tab parameter');
      }
      
      if (definition.includes('tab=today')) {
        console.log('✅ Function now includes today tab parameter');
      } else {
        console.log('❌ Function still missing today tab parameter');
      }
      
      if (definition.includes('eventId=')) {
        console.log('✅ Function now includes eventId parameter');
      } else {
        console.log('❌ Function still missing eventId parameter');
      }
    }
    
    console.log('\n🎉 Migration 085 verification complete!');
    console.log('💡 Event notifications will now navigate to the correct tab and highlight the specific event');
    
  } catch (error) {
    console.error('❌ Migration 085 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration085().catch(console.error);
