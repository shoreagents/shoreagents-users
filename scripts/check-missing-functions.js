const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkMissingFunctions() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking for missing functions called by check_break_reminders...\n');
    
    const functionsToCheck = [
      'is_break_available_soon',
      'is_break_available_now', 
      'is_break_reminder_due',
      'is_break_window_ending_soon',
      'create_break_reminder_notification'
    ];
    
    for (const funcName of functionsToCheck) {
      console.log(`🔍 Checking ${funcName}...`);
      
      const result = await client.query(`
        SELECT 
          proname,
          oid::regprocedure as full_signature
        FROM pg_proc 
        WHERE proname = $1
      `, [funcName]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Found ${result.rows.length} function(s):`);
        result.rows.forEach((func, index) => {
          console.log(`     ${index + 1}. ${func.full_signature}`);
        });
      } else {
        console.log(`   ❌ Function ${funcName} NOT FOUND`);
      }
    }
    
    // Test each function individually with agent ID 2
    console.log('\n🧪 Testing each function with agent ID 2...\n');
    
    for (const funcName of functionsToCheck) {
      console.log(`Testing ${funcName}...`);
      
      try {
        let query = '';
        switch (funcName) {
          case 'is_break_available_soon':
          case 'is_break_available_now':
          case 'is_break_window_ending_soon':
            query = `SELECT ${funcName}(2, 'Lunch'::break_type_enum) as result`;
            break;
          case 'is_break_reminder_due':
            query = `SELECT ${funcName}(2, 'Lunch'::break_type_enum) as result`;
            break;
          case 'create_break_reminder_notification':
            // Skip testing this one as it creates data
            console.log(`   ⏭️ Skipping ${funcName} (creates data)`);
            continue;
        }
        
        const testResult = await client.query(query);
        console.log(`   ✅ ${funcName}: ${testResult.rows[0].result}`);
        
      } catch (error) {
        console.log(`   ❌ ${funcName} failed: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error checking functions:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkMissingFunctions();
