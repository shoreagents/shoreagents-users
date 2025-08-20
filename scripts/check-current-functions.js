const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentFunctions() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking current function implementations...\n');
    
    // Test calculate_break_windows directly
    console.log('1️⃣ Testing calculate_break_windows(2)...');
    try {
      const breakWindows = await client.query('SELECT * FROM calculate_break_windows(2)');
      console.log(`   ✅ Success: Found ${breakWindows.rows.length} break windows`);
      if (breakWindows.rows.length > 0) {
        breakWindows.rows.forEach((window, index) => {
          console.log(`     ${index + 1}. ${window.break_type}: ${window.start_time} - ${window.end_time}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test is_break_reminder_due directly
    console.log('\n2️⃣ Testing is_break_reminder_due(2, \'Lunch\')...');
    try {
      const reminderDue = await client.query(`
        SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum) as result
      `);
      console.log(`   ✅ Success: ${reminderDue.rows[0].result}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Test check_break_reminders
    console.log('\n3️⃣ Testing check_break_reminders()...');
    try {
      const result = await client.query('SELECT check_break_reminders()');
      console.log(`   ✅ Success: ${result.rows[0].check_break_reminders} notifications sent`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      
      // If there's an error, let's check the function source
      console.log('\n🔍 Checking check_break_reminders function source...');
      try {
        const functionSource = await client.query(`
          SELECT prosrc FROM pg_proc WHERE proname = 'check_break_reminders'
        `);
        if (functionSource.rows.length > 0) {
          const source = functionSource.rows[0].prosrc;
          console.log('   Function source preview:');
          const lines = source.split('\n').slice(0, 20);
          lines.forEach((line, index) => {
            console.log(`      ${index + 1}: ${line}`);
          });
          if (source.split('\n').length > 20) {
            console.log('      ... (truncated)');
          }
        }
      } catch (sourceError) {
        console.log(`   Error getting source: ${sourceError.message}`);
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
checkCurrentFunctions();
