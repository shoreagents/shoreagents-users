const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function test6am3pmNotifications() {
  try {
    console.log('🧪 Testing 6AM-3PM Shift Notifications...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // First verify the shift time
    console.log('1️⃣ Verifying shift time:');
    const shiftResult = await pool.query(`
      SELECT ji.shift_time 
      FROM job_info ji 
      WHERE ji.agent_user_id = $1 OR ji.internal_user_id = $1
    `, [testAgentId]);
    
    if (shiftResult.rows.length > 0) {
      console.log(`   Current shift: ${shiftResult.rows[0].shift_time}`);
    }
    
    // Verify break windows
    console.log('\n2️⃣ Break windows:');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) ORDER BY start_time
    `, [testAgentId]);
    
    breakWindowsResult.rows.forEach(window => {
      const startTime = window.start_time;
      const endTime = window.end_time;
      
      // Convert to 12-hour format
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      let startAmPm = startHour >= 12 ? 'PM' : 'AM';
      let endAmPm = endHour >= 12 ? 'PM' : 'AM';
      
      let displayStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
      let displayEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
      
      console.log(`   ${window.break_type}: ${displayStartHour}:${startTime.split(':')[1]} ${startAmPm} - ${displayEndHour}:${endTime.split(':')[1]} ${endAmPm}`);
    });
    
    // Test all the specific notification times you mentioned
    console.log('\n3️⃣ Testing specific notification times:\n');
    
    const testCases = [
      // Morning Break (8:00 AM - 9:00 AM)
      { time: '2025-08-20 07:45:00', label: '7:45 AM', breakType: 'Morning', expected: 'available_soon', message: 'Morning Break available soon' },
      { time: '2025-08-20 08:00:00', label: '8:00 AM', breakType: 'Morning', expected: 'available_now', message: 'Morning Break is now available' },
      { time: '2025-08-20 08:30:00', label: '8:30 AM', breakType: 'Morning', expected: 'reminder', message: 'Morning Break you haven\'t taken your breaks' },
      { time: '2025-08-20 08:45:00', label: '8:45 AM', breakType: 'Morning', expected: 'ending_soon', message: 'Morning Break expires in 15 minutes' },
      
      // Lunch Break (10:00 AM - 1:00 PM)
      { time: '2025-08-20 09:45:00', label: '9:45 AM', breakType: 'Lunch', expected: 'available_soon', message: 'Lunch Break available soon' },
      { time: '2025-08-20 10:00:00', label: '10:00 AM', breakType: 'Lunch', expected: 'available_now', message: 'Lunch Break is now available' },
      { time: '2025-08-20 10:30:00', label: '10:30 AM', breakType: 'Lunch', expected: 'reminder', message: 'Lunch Break you haven\'t taken your breaks' },
      { time: '2025-08-20 12:45:00', label: '12:45 PM', breakType: 'Lunch', expected: 'ending_soon', message: 'Lunch Break expires in 15 minutes' },
      
      // Afternoon Break (1:45 PM - 2:45 PM)
      { time: '2025-08-20 13:30:00', label: '1:30 PM', breakType: 'Afternoon', expected: 'available_soon', message: 'Afternoon Break available soon' },
      { time: '2025-08-20 13:45:00', label: '1:45 PM', breakType: 'Afternoon', expected: 'available_now', message: 'Afternoon Break is now available' },
      { time: '2025-08-20 14:15:00', label: '2:15 PM', breakType: 'Afternoon', expected: 'reminder', message: 'Afternoon Break you haven\'t taken your breaks' },
      { time: '2025-08-20 14:30:00', label: '2:30 PM', breakType: 'Afternoon', expected: 'ending_soon', message: 'Afternoon Break expires in 15 minutes' }
    ];
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const testCase of testCases) {
      console.log(`🕐 ${testCase.label} - ${testCase.breakType} Break:`);
      console.log(`   Expected: ${testCase.message}`);
      
      try {
        // Test all functions
        const availableSoonResult = await pool.query(`
          SELECT is_break_available_soon($1, $2, $3::timestamp without time zone) as result
        `, [testAgentId, testCase.breakType, testCase.time]);
        
        const availableNowResult = await pool.query(`
          SELECT is_break_available_now($1, $2, $3::timestamp without time zone) as result
        `, [testAgentId, testCase.breakType, testCase.time]);
        
        const reminderDueResult = await pool.query(`
          SELECT is_break_reminder_due($1, $2, $3::timestamp without time zone) as result
        `, [testAgentId, testCase.breakType, testCase.time]);
        
        const endingSoonResult = await pool.query(`
          SELECT is_break_window_ending_soon($1, $2, $3::timestamp without time zone) as result
        `, [testAgentId, testCase.breakType, testCase.time]);
        
        const availableSoon = availableSoonResult.rows[0].result;
        const availableNow = availableNowResult.rows[0].result;
        const reminderDue = reminderDueResult.rows[0].result;
        const endingSoon = endingSoonResult.rows[0].result;
        
        // Check which function should be true
        let actualResult = false;
        switch (testCase.expected) {
          case 'available_soon':
            actualResult = availableSoon;
            break;
          case 'available_now':
            actualResult = availableNow;
            break;
          case 'reminder':
            actualResult = reminderDue;
            break;
          case 'ending_soon':
            actualResult = endingSoon;
            break;
        }
        
        const passed = actualResult === true;
        totalTests++;
        if (passed) passedTests++;
        
        console.log(`   Soon: ${availableSoon ? '✅' : '❌'} | Now: ${availableNow ? '✅' : '❌'} | Remind: ${reminderDue ? '✅' : '❌'} | End: ${endingSoon ? '✅' : '❌'}`);
        console.log(`   Result: ${passed ? '🎉 PASS' : '❌ FAIL'}\n`);
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        totalTests++;
      }
    }
    
    // Final summary
    console.log('📊 FINAL RESULTS:');
    console.log('═'.repeat(60));
    const percentage = Math.round((passedTests / totalTests) * 100);
    console.log(`Overall: ${passedTests}/${totalTests} (${percentage}%) ${percentage === 100 ? '✅ WORKING' : '❌ ISSUES'}`);
    
    if (percentage === 100) {
      console.log('\n🎉 ALL NOTIFICATIONS ARE WORKING PERFECTLY! ✅');
      console.log('🔔 You will receive all 12 notifications at the correct times');
    } else {
      console.log('\n❌ SOME NOTIFICATIONS HAVE ISSUES');
      console.log(`🔧 ${totalTests - passedTests} out of ${totalTests} notifications need fixing`);
    }
    
  } catch (error) {
    console.error('❌ Error testing 6AM-3PM notifications:', error.message);
  } finally {
    await pool.end();
  }
}

test6am3pmNotifications();
