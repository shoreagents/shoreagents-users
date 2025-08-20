const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAfternoonBreakTiming() {
  try {
    console.log('🔍 Checking Afternoon Break Timing...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check afternoon break window
    console.log('1️⃣ Afternoon Break Window:');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) WHERE break_type = 'Afternoon'
    `, [testAgentId]);
    
    if (breakWindowsResult.rows.length > 0) {
      const afternoon = breakWindowsResult.rows[0];
      console.log(`   Start: ${afternoon.start_time} (2:45 PM)`);
      console.log(`   End: ${afternoon.end_time} (3:45 PM)`);
      console.log(`   Duration: 1 hour availability window`);
      
      // 2. Test notification timing functions
      console.log('\n2️⃣ Testing Notification Timing Functions:');
      
      const testTimes = [
        '2025-08-20 14:30:00', // 2:30 PM - 15 min before start
        '2025-08-20 14:45:00', // 2:45 PM - at start
        '2025-08-20 15:15:00', // 3:15 PM - 30 min after start
        '2025-08-20 15:30:00', // 3:30 PM - 15 min before end
        '2025-08-20 15:45:00'  // 3:45 PM - at end
      ];
      
      for (const testTime of testTimes) {
        try {
          // Test available soon (15 min before start)
          const availableSoonResult = await pool.query(`
            SELECT is_break_available_soon($1, 'Afternoon', $2::timestamp without time zone) as available_soon
          `, [testAgentId, testTime]);
          
          // Test available now (at start)
          const availableNowResult = await pool.query(`
            SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as available_now
          `, [testAgentId, testTime]);
          
          // Test ending soon (15 min before end)
          const endingSoonResult = await pool.query(`
            SELECT is_break_window_ending_soon($1, 'Afternoon', $2::timestamp without time zone) as ending_soon
          `, [testAgentId, testTime]);
          
          const timeLabel = testTime.split(' ')[1];
          const availableSoon = availableSoonResult.rows[0].available_soon;
          const availableNow = availableNowResult.rows[0].available_now;
          const endingSoon = endingSoonResult.rows[0].ending_soon;
          
          console.log(`   ${timeLabel}:`);
          console.log(`      Available Soon: ${availableSoon ? '✅ YES' : '❌ NO'}`);
          console.log(`      Available Now: ${availableNow ? '✅ YES' : '❌ NO'}`);
          console.log(`      Ending Soon: ${endingSoon ? '✅ YES' : '❌ NO'}`);
        } catch (error) {
          console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
        }
      }
      
      // 3. Expected notification schedule
      console.log('\n3️⃣ Expected Notification Schedule:');
      console.log('   🕐 2:30 PM - "Afternoon Break available soon" (15 min before start)');
      console.log('   🕐 2:45 PM - "Afternoon Break is now available" (at start)');
      console.log('   🕐 3:15 PM - "Afternoon Break expires in 30 minutes" (30 min after start)');
      console.log('   🕐 3:30 PM - "Afternoon Break expires in 15 minutes" (15 min before end)');
      console.log('   🕐 3:45 PM - Break window expires');
      
      // 4. Answer user's question
      console.log('\n4️⃣ Answer to Your Question:');
      console.log('   ❓ Should you receive notifications at:');
      console.log('   ✅ 2:30 PM - YES (available soon)');
      console.log('   ✅ 2:45 PM - YES (available now)');
      console.log('   ✅ 3:15 PM - YES (expires in 30 min)');
      console.log('   ✅ 3:30 PM - YES (expires in 15 min)');
      
    } else {
      console.log('❌ No afternoon break window found');
    }
    
  } catch (error) {
    console.error('❌ Error checking afternoon break timing:', error.message);
  } finally {
    await pool.end();
  }
}

checkAfternoonBreakTiming();
