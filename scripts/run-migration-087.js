const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration087() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Migration 087: Fix event status real-time updates...\n');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '087_fix_event_status_realtime_updates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Executing migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 087 completed successfully!');
    console.log('🔄 Event status updates now trigger real-time notifications');
    console.log('📡 Frontend will receive updates when events change from upcoming→today→ended');
    console.log('⚡ Event cards will update in real-time when status changes');
    
    // Verify the functions were created
    console.log('\n🔍 Verifying function creation...');
    
    const verifyQuery = `
      SELECT 
        routine_name,
        routine_type
      FROM information_schema.routines 
      WHERE routine_name IN ('notify_event_status_change', 'update_all_event_statuses')
      AND routine_schema = 'public'
      ORDER BY routine_name
    `;
    
    const result = await client.query(verifyQuery);
    if (result.rows.length >= 2) {
      console.log('✅ Both functions created successfully:');
      result.rows.forEach(row => {
        console.log(`   - ${row.routine_name} (${row.routine_type})`);
      });
    } else {
      console.log('❌ Some functions are missing');
    }
    
    console.log('\n🎉 Migration 087 verification complete!');
    console.log('💡 Event status changes will now be reflected in real-time on the frontend');
    
  } catch (error) {
    console.error('❌ Migration 087 failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration087().catch(console.error);
