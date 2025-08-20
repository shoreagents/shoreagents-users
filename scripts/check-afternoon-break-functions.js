const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAfternoonBreakFunctions() {
  try {
    console.log('🔍 Debugging Afternoon Break Functions...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    const testTime = '2025-08-20 14:30:00'; // 2:30 PM - should trigger "available soon"
    
    console.log('1️⃣ Testing at 2:30 PM (14:30:00):');
    console.log('   This should be 15 minutes before afternoon break starts at 2:45 PM');
    
    // Check break windows
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) WHERE break_type = 'Afternoon'
    `, [testAgentId]);
    
    if (breakWindowsResult.rows.length > 0) {
      const afternoon = breakWindowsResult.rows[0];
      console.log(`   Afternoon break window: ${afternoon.start_time} - ${afternoon.end_time}`);
      
      // Test the available soon function
      const availableSoonResult = await pool.query(`
        SELECT is_break_available_soon($1, 'Afternoon', $2::timestamp without time zone) as available_soon
      `, [testAgentId, testTime]);
      
      const isAvailableSoon = availableSoonResult.rows[0].available_soon;
      console.log(`   is_break_available_soon result: ${isAvailableSoon ? '✅ TRUE' : '❌ FALSE'}`);
      console.log(`   Expected: ✅ TRUE (15 minutes before 2:45 PM start)`);
      
      if (!isAvailableSoon) {
        console.log('\n2️⃣ Debugging why function returned FALSE:');
        
        // Check if break was already taken
        const breakTakenResult = await pool.query(`
          SELECT EXISTS(
            SELECT 1 FROM break_sessions
            WHERE agent_user_id = $1
            AND break_type = 'Afternoon'
            AND break_date = CURRENT_DATE
          ) as break_already_taken
        `, [testAgentId]);
        
        const breakAlreadyTaken = breakTakenResult.rows[0].break_already_taken;
        console.log(`   Break already taken today: ${breakAlreadyTaken ? 'YES' : 'NO'}`);
        
        // Check shift info
        const shiftInfoResult = await pool.query(`
          SELECT * FROM get_agent_shift_info($1) LIMIT 1
        `, [testAgentId]);
        
        if (shiftInfoResult.rows.length > 0) {
          const shiftInfo = shiftInfoResult.rows[0];
          console.log(`   Shift time: ${shiftInfo.shift_time}`);
          console.log(`   Shift start: ${shiftInfo.shift_start}`);
          console.log(`   Shift end: ${shiftInfo.shift_end}`);
        }
        
        // Manual time calculation
        const testTimeObj = new Date(`2025-08-20 ${testTime}`);
        const startTimeObj = new Date(`2025-08-20 ${afternoon.start_time}`);
        const minutesUntilStart = Math.round((startTimeObj - testTimeObj) / (1000 * 60));
        
        console.log(`   Manual calculation: ${minutesUntilStart} minutes until start`);
        console.log(`   Function should return TRUE if ${minutesUntilStart} is between 13-17 minutes`);
      }
    }
    
    // Test available now at 2:45 PM
    console.log('\n3️⃣ Testing at 2:45 PM (14:45:00):');
    const testTime2 = '2025-08-20 14:45:00';
    
    const availableNowResult = await pool.query(`
      SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as available_now
    `, [testAgentId, testTime2]);
    
    const isAvailableNow = availableNowResult.rows[0].available_now;
    console.log(`   is_break_available_now result: ${isAvailableNow ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`   Expected: ✅ TRUE (at start time 2:45 PM)`);
    
    // Test 30-minute reminder at 3:15 PM
    console.log('\n4️⃣ Testing at 3:15 PM (15:15:00):');
    const testTime3 = '2025-08-20 15:15:00';
    
    // This should trigger the 30-minute reminder logic
    const reminderResult = await pool.query(`
      SELECT is_break_reminder_due($1, 'Afternoon', $2::timestamp without time zone) as reminder_due
    `, [testAgentId, testTime3]);
    
    const isReminderDue = reminderResult.rows[0].reminder_due;
    console.log(`   is_break_reminder_due result: ${isReminderDue ? '✅ TRUE' : '❌ FALSE'}`);
    console.log(`   Expected: ✅ TRUE (30 minutes after start)`);
    
  } catch (error) {
    console.error('❌ Error debugging afternoon break functions:', error.message);
  } finally {
    await pool.end();
  }
}

checkAfternoonBreakFunctions();
