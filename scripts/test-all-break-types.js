const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testAllBreakTypes() {
  try {
    console.log('🧪 Testing ALL Break Types: Morning, Lunch, Afternoon...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // First, get all break windows
    console.log('📅 Break Windows:');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) ORDER BY start_time
    `, [testAgentId]);
    
    breakWindowsResult.rows.forEach(window => {
      console.log(`   ${window.break_type}: ${window.start_time} - ${window.end_time}`);
    });
    console.log('');
    
    // Define test cases for each break type
    const testCases = [
      // MORNING BREAK (9:00 AM - 10:00 AM)
      {
        breakType: 'Morning',
        tests: [
          { time: '2025-08-20 08:45:00', label: '8:45 AM', description: '15 min before start', expected: 'available_soon' },
          { time: '2025-08-20 09:00:00', label: '9:00 AM', description: 'at start', expected: 'available_now' },
          { time: '2025-08-20 09:30:00', label: '9:30 AM', description: '30 min after start', expected: 'reminder_due' },
          { time: '2025-08-20 09:45:00', label: '9:45 AM', description: '15 min before end', expected: 'ending_soon' }
        ]
      },
      // LUNCH BREAK (11:00 AM - 2:00 PM)
      {
        breakType: 'Lunch',
        tests: [
          { time: '2025-08-20 10:45:00', label: '10:45 AM', description: '15 min before start', expected: 'available_soon' },
          { time: '2025-08-20 11:00:00', label: '11:00 AM', description: 'at start', expected: 'available_now' },
          { time: '2025-08-20 11:30:00', label: '11:30 AM', description: '30 min after start', expected: 'reminder_due' },
          { time: '2025-08-20 13:45:00', label: '1:45 PM', description: '15 min before end', expected: 'ending_soon' }
        ]
      },
      // AFTERNOON BREAK (2:45 PM - 3:45 PM)
      {
        breakType: 'Afternoon',
        tests: [
          { time: '2025-08-20 14:30:00', label: '2:30 PM', description: '15 min before start', expected: 'available_soon' },
          { time: '2025-08-20 14:45:00', label: '2:45 PM', description: 'at start', expected: 'available_now' },
          { time: '2025-08-20 15:15:00', label: '3:15 PM', description: '30 min after start', expected: 'reminder_due' },
          { time: '2025-08-20 15:30:00', label: '3:30 PM', description: '15 min before end', expected: 'ending_soon' }
        ]
      }
    ];
    
    let overallResults = {
      morning: { passed: 0, total: 0 },
      lunch: { passed: 0, total: 0 },
      afternoon: { passed: 0, total: 0 }
    };
    
    for (const breakTypeTest of testCases) {
      console.log(`🔍 Testing ${breakTypeTest.breakType.toUpperCase()} BREAK:`);
      console.log('─'.repeat(50));
      
      for (const test of breakTypeTest.tests) {
        console.log(`🕐 ${test.label} (${test.description}):`);
        
        try {
          // Test all functions
          const availableSoonResult = await pool.query(`
            SELECT is_break_available_soon($1, $2, $3::timestamp without time zone) as result
          `, [testAgentId, breakTypeTest.breakType, test.time]);
          
          const availableNowResult = await pool.query(`
            SELECT is_break_available_now($1, $2, $3::timestamp without time zone) as result
          `, [testAgentId, breakTypeTest.breakType, test.time]);
          
          const reminderDueResult = await pool.query(`
            SELECT is_break_reminder_due($1, $2, $3::timestamp without time zone) as result
          `, [testAgentId, breakTypeTest.breakType, test.time]);
          
          const endingSoonResult = await pool.query(`
            SELECT is_break_window_ending_soon($1, $2, $3::timestamp without time zone) as result
          `, [testAgentId, breakTypeTest.breakType, test.time]);
          
          const availableSoon = availableSoonResult.rows[0].result;
          const availableNow = availableNowResult.rows[0].result;
          const reminderDue = reminderDueResult.rows[0].result;
          const endingSoon = endingSoonResult.rows[0].result;
          
          // Check which function should be true
          let expectedPassed = false;
          switch (test.expected) {
            case 'available_soon':
              expectedPassed = availableSoon === true;
              break;
            case 'available_now':
              expectedPassed = availableNow === true;
              break;
            case 'reminder_due':
              expectedPassed = reminderDue === true;
              break;
            case 'ending_soon':
              expectedPassed = endingSoon === true;
              break;
          }
          
          console.log(`   Soon: ${availableSoon ? '✅' : '❌'} | Now: ${availableNow ? '✅' : '❌'} | Remind: ${reminderDue ? '✅' : '❌'} | End: ${endingSoon ? '✅' : '❌'}`);
          console.log(`   Expected: ${test.expected} = TRUE`);
          console.log(`   Result: ${expectedPassed ? '🎉 PASS' : '❌ FAIL'}\n`);
          
          // Update results
          const breakKey = breakTypeTest.breakType.toLowerCase();
          overallResults[breakKey].total++;
          if (expectedPassed) {
            overallResults[breakKey].passed++;
          }
          
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}\n`);
          const breakKey = breakTypeTest.breakType.toLowerCase();
          overallResults[breakKey].total++;
        }
      }
      
      console.log('');
    }
    
    // Final summary
    console.log('📊 FINAL RESULTS:');
    console.log('═'.repeat(60));
    
    let allBreaksWorking = true;
    
    Object.keys(overallResults).forEach(breakType => {
      const result = overallResults[breakType];
      const percentage = Math.round((result.passed / result.total) * 100);
      const status = result.passed === result.total ? '✅ WORKING' : '❌ ISSUES';
      
      console.log(`${breakType.toUpperCase().padEnd(10)}: ${result.passed}/${result.total} (${percentage}%) ${status}`);
      
      if (result.passed !== result.total) {
        allBreaksWorking = false;
      }
    });
    
    console.log('═'.repeat(60));
    
    if (allBreaksWorking) {
      console.log('🎉 ALL BREAK TYPES ARE WORKING PERFECTLY! ✅');
      console.log('\n🔔 You will receive notifications for:');
      console.log('   ✅ Morning Break: 8:45 AM, 9:00 AM, 9:30 AM, 9:45 AM');
      console.log('   ✅ Lunch Break: 10:45 AM, 11:00 AM, 11:30 AM, 1:45 PM');
      console.log('   ✅ Afternoon Break: 2:30 PM, 2:45 PM, 3:15 PM, 3:30 PM');
    } else {
      console.log('❌ SOME BREAK TYPES HAVE ISSUES');
      console.log('🔧 Need to investigate and fix the failing break types');
    }
    
  } catch (error) {
    console.error('❌ Error testing all break types:', error.message);
  } finally {
    await pool.end();
  }
}

testAllBreakTypes();
