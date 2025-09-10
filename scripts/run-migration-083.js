const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration083() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Migration 083: Restore real-time event notifications...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '083_restore_realtime_event_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 083 completed successfully!');
    console.log('📡 Real-time event notifications have been restored');
    console.log('🔧 The notify_event_change function now includes pg_notify calls for socket server updates');
    
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
      
      if (definition.includes('pg_notify')) {
        console.log('✅ Function now contains pg_notify calls');
      } else {
        console.log('❌ Function still missing pg_notify calls');
      }
      
      if (definition.includes('event_changes')) {
        console.log('✅ Function now contains event_changes channel');
      } else {
        console.log('❌ Function still missing event_changes channel');
      }
      
      if (definition.includes('TG_OP')) {
        console.log('✅ Function now handles trigger operations (INSERT/UPDATE/DELETE)');
      } else {
        console.log('❌ Function still missing trigger operation handling');
      }
    }
    
    console.log('\n🎉 Migration 083 verification complete!');
    console.log('💡 Real-time event updates should now work properly');
    
  } catch (error) {
    console.error('❌ Migration 083 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration083().catch(console.error);
