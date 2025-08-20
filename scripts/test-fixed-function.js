const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFixedFunction() {
  try {
    console.log('🧪 Testing Fixed is_break_window_ending_soon Function...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // Test the function at 1:45 PM (13:45:00) - should return TRUE
    // This is 15 minutes before lunch break window ends at 2:00 PM (14:00:00)
    const testTime = '2025-08-20 13:45:00'; // 1:45 PM in 24-hour format
    
    console.log('1️⃣ Testing at 1:45 PM (13:45:00):');
    console.log(`   This should be 15 minutes before lunch break window ends at 2:00 PM`);
    
    const result = await pool.query(`
      SELECT 
        is_break_window_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
    `, [testAgentId, testTime]);
    
    const isEndingSoon = result.rows[0].lunch_ending_soon;
    console.log(`   Result: ${isEndingSoon ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`   Expected: ✅ TRUE (15 minutes before 2:00 PM end)`);
    
    if (isEndingSoon) {
      console.log('\n🎉 SUCCESS! The function now correctly detects that lunch break is ending soon at 1:45 PM');
      console.log('   You should now receive the "Break ending soon" notification at 1:45 PM');
    } else {
      console.log('\n❌ The function is still not working correctly');
      console.log('   Let me investigate further...');
      
      // Check what's happening
      const breakWindowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows($1) WHERE break_type = 'Lunch'
      `, [testAgentId]);
      
      if (breakWindowsResult.rows.length > 0) {
        const lunchWindow = breakWindowsResult.rows[0];
        console.log(`   Lunch break window: ${lunchWindow.start_time} - ${lunchWindow.end_time}`);
        
        // Calculate minutes until end
        const testTimeObj = new Date(`2025-08-20 ${testTime}`);
        const endTimeObj = new Date(`2025-08-20 ${lunchWindow.end_time}`);
        const minutesUntilEnd = Math.round((endTimeObj - testTimeObj) / (1000 * 60));
        
        console.log(`   At ${testTime}: ${minutesUntilEnd} minutes until end`);
        console.log(`   Function should return TRUE if ${minutesUntilEnd} is between 13-17 minutes`);
      }
    }
    
    // Test a few more times around the critical window
    console.log('\n2️⃣ Testing multiple times around the critical window:');
    const testTimes = [
      '2025-08-20 13:40:00', // 20 minutes before end
      '2025-08-20 13:43:00', // 17 minutes before end - should trigger
      '2025-08-20 13:45:00', // 15 minutes before end - should trigger
      '2025-08-20 13:47:00', // 13 minutes before end - should trigger
      '2025-08-20 13:50:00', // 10 minutes before end
    ];
    
    for (const time of testTimes) {
      try {
        const timeResult = await pool.query(`
          SELECT 
            is_break_window_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
        `, [testAgentId, time]);
        
        const timeLabel = time.split(' ')[1];
        const isEndingSoon = timeResult.rows[0].lunch_ending_soon;
        console.log(`   ${timeLabel}: ${isEndingSoon ? '✅ TRUE' : '❌ FALSE'}`);
      } catch (error) {
        console.log(`   ${time.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing fixed function:', error.message);
  } finally {
    await pool.end();
  }
}

testFixedFunction();
