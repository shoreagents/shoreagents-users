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
    console.log('🚀 Starting Migration 071: Clean up start_meeting function...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '071_clean_start_meeting_function.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 071 completed successfully!');
    console.log('📝 Changes made:');
    console.log('   • Dropped all existing start_meeting functions');
    console.log('   • Created a clean start_meeting function');
    console.log('   • Function now uses actual start time for duration calculation');
    
    // Test the function to make sure it works
    console.log('\n🧪 Testing the updated function...');
    const testResult = await client.query(`
      SELECT 
        routine_name, 
        specific_name,
        routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'start_meeting' 
      AND routine_type = 'FUNCTION'
    `);
    
    if (testResult.rows.length > 0) {
      console.log(`✅ Found ${testResult.rows.length} start_meeting function(s)`);
      testResult.rows.forEach((row, index) => {
        if (row.routine_definition.includes('start_time = NOW()')) {
          console.log(`   ✅ Function ${index + 1} uses actual start time`);
        } else {
          console.log(`   ❌ Function ${index + 1} has old logic`);
        }
      });
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
    console.log('\n🎉 Migration 071 completed successfully!');
    console.log('💡 Next steps:');
    console.log('   • Restart your application to use the updated function');
    console.log('   • New meetings will show correct duration from actual start time');
    console.log('   • Test scheduling a meeting for a future time');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
