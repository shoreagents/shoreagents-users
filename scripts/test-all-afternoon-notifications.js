const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testAllAfternoonNotifications() {
  try {
    console.log('🧪 Testing ALL Afternoon Break Notifications...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    console.log('📅 Afternoon Break Window: 2:45 PM - 3:45 PM (1 hour availability)\n');
    
    const testCases = [
      {
        time: '2025-08-20 14:30:00',
        label: '2:30 PM',
        description: '15 minutes before start',
        expectedFunction: 'available_soon',
        expectedResult: true
      },
      {
        time: '2025-08-20 14:45:00',
        label: '2:45 PM',
        description: 'at start time',
        expectedFunction: 'available_now',
        expectedResult: true
      },
      {
        time: '2025-08-20 15:15:00',
        label: '3:15 PM',
        description: '30 minutes after start',
        expectedFunction: 'reminder_due',
        expectedResult: true
      },
      {
        time: '2025-08-20 15:30:00',
        label: '3:30 PM',
        description: '15 minutes before end',
        expectedFunction: 'ending_soon',
        expectedResult: true
      }
    ];
    
    let allPassed = true;
    
    for (const testCase of testCases) {
      console.log(`🕐 Testing ${testCase.label} (${testCase.description}):`);
      
      try {
        // Test available soon
        const availableSoonResult = await pool.query(`
          SELECT is_break_available_soon($1, 'Afternoon', $2::timestamp without time zone) as result
        `, [testAgentId, testCase.time]);
        
        // Test available now
        const availableNowResult = await pool.query(`
          SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as result
        `, [testAgentId, testCase.time]);
        
        // Test reminder due
        const reminderDueResult = await pool.query(`
          SELECT is_break_reminder_due($1, 'Afternoon', $2::timestamp without time zone) as result
        `, [testAgentId, testCase.time]);
        
        // Test ending soon
        const endingSoonResult = await pool.query(`
          SELECT is_break_window_ending_soon($1, 'Afternoon', $2::timestamp without time zone) as result
        `, [testAgentId, testCase.time]);
        
        const availableSoon = availableSoonResult.rows[0].result;
        const availableNow = availableNowResult.rows[0].result;
        const reminderDue = reminderDueResult.rows[0].result;
        const endingSoon = endingSoonResult.rows[0].result;
        
        // Check which function should be true
        let expectedPassed = false;
        let actualResult = false;
        
        switch (testCase.expectedFunction) {
          case 'available_soon':
            expectedPassed = availableSoon === testCase.expectedResult;
            actualResult = availableSoon;
            break;
          case 'available_now':
            expectedPassed = availableNow === testCase.expectedResult;
            actualResult = availableNow;
            break;
          case 'reminder_due':
            expectedPassed = reminderDue === testCase.expectedResult;
            actualResult = reminderDue;
            break;
          case 'ending_soon':
            expectedPassed = endingSoon === testCase.expectedResult;
            actualResult = endingSoon;
            break;
        }
        
        console.log(`   Available Soon: ${availableSoon ? '✅' : '❌'} | Available Now: ${availableNow ? '✅' : '❌'} | Reminder Due: ${reminderDue ? '✅' : '❌'} | Ending Soon: ${endingSoon ? '✅' : '❌'}`);
        console.log(`   Expected: ${testCase.expectedFunction} = ${testCase.expectedResult ? 'TRUE' : 'FALSE'}`);
        console.log(`   Result: ${expectedPassed ? '🎉 PASS' : '❌ FAIL'}\n`);
        
        if (!expectedPassed) {
          allPassed = false;
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
        allPassed = false;
      }
    }
    
    // Final summary
    console.log('📋 FINAL SUMMARY:');
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! ✅');
      console.log('\n🔔 You should receive notifications at:');
      console.log('   ✅ 2:30 PM - "Afternoon Break available soon"');
      console.log('   ✅ 2:45 PM - "Afternoon Break is now available"');
      console.log('   ✅ 3:15 PM - "Afternoon Break expires in 30 minutes"');
      console.log('   ✅ 3:30 PM - "Afternoon Break expires in 15 minutes"');
      console.log('\n🚀 The afternoon break notification system is now working perfectly!');
    } else {
      console.log('❌ SOME TESTS FAILED');
      console.log('🔧 The afternoon break notification system needs further adjustments');
    }
    
  } catch (error) {
    console.error('❌ Error testing afternoon notifications:', error.message);
  } finally {
    await pool.end();
  }
}

testAllAfternoonNotifications();
