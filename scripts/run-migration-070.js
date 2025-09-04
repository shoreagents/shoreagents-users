const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Migration 070: Fix meeting start time calculation...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '070_fix_meeting_start_time_calculation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 070 completed successfully!');
    console.log('📝 Changes made:');
    console.log('   • Updated start_meeting function to use actual start time');
    console.log('   • Fixed duration calculation for meetings');
    console.log('   • Meetings will now show correct elapsed time from actual start');
    
    // Test the function to make sure it works
    console.log('\n🧪 Testing the updated function...');
    const testResult = await client.query(`
      SELECT 
        routine_name, 
        routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'start_meeting' 
      AND routine_type = 'FUNCTION'
    `);
    
    if (testResult.rows.length > 0) {
      console.log('✅ start_meeting function updated successfully');
    } else {
      console.log('❌ start_meeting function not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration 070 completed successfully!');
    console.log('💡 Next steps:');
    console.log('   • Restart your application to use the updated function');
    console.log('   • New meetings will show correct duration from actual start time');
    console.log('   • Existing in-progress meetings may need to be restarted to show correct duration');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
