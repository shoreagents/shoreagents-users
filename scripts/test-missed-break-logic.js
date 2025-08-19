const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testMissedBreakLogic() {
  try {
    console.log('🔍 Testing Missed Break Logic...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check current time and break status
    console.log('1️⃣ Current time and break status:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // 2. Test missed break logic at different times
    console.log('\n2️⃣ Testing missed break logic at different times:');
    
    const testTimes = [
      '2025-08-19 10:30:00', // 10:30 AM - should be missed (30 min after start)
      '2025-08-19 11:00:00', // 11:00 AM - should be missed (1 hour after start)
      '2025-08-19 11:30:00', // 11:30 AM - should be missed (1.5 hours after start)
      '2025-08-19 12:00:00', // 12:00 PM - should be missed (2 hours after start)
      '2025-08-19 12:30:00', // 12:30 PM - should be missed (2.5 hours after start)
      '2025-08-19 13:00:00', // 1:00 PM - break window ends
      '2025-08-19 13:30:00', // 1:30 PM - definitely missed (30 min after end)
    ];
    
    for (const testTime of testTimes) {
      try {
        const result = await pool.query(`
          SELECT 
            is_break_missed($1, 'Lunch', $2::timestamp without time zone) as lunch_missed
        `, [testAgentId, testTime]);
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        console.log(`   ${timeLabel}: ${result.rows[0].lunch_missed ? '✅ MISSED' : '❌ Not missed'}`);
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 3. Check the is_break_missed function source
    console.log('\n3️⃣ Checking is_break_missed function logic:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_missed'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for specific logic
      if (source.includes('break window has passed')) {
        console.log('\n   📍 Found "break window has passed" logic');
      }
      if (source.includes('current time > break_end_time')) {
        console.log('   📍 Found time comparison logic');
      }
    }
    
    // 4. Test manual notification creation for missed break
    console.log('\n4️⃣ Testing manual missed break notification:');
    
    // Test if we can create a "missed break" notification manually
    try {
      const notificationResult = await pool.query(`
        SELECT create_break_reminder_notification($1, 'missed_break', 'Lunch')
      `, [testAgentId]);
      
      console.log('   ✅ Created missed break notification manually');
      
      // Check if it was created
      const newNotificationResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = $1
        AND category = 'break'
        AND type = 'missed_break'
        AND created_at > NOW() - INTERVAL '1 minute'
      `, [testAgentId]);
      
      console.log(`   📊 New missed break notifications: ${newNotificationResult.rows[0].count}`);
      
    } catch (error) {
      console.log(`   ❌ Manual notification failed: ${error.message}`);
    }
    
    // 5. Check if the issue is with the scheduler timing
    console.log('\n5️⃣ Scheduler timing analysis:');
    console.log('   The scheduler should run every 2 minutes');
    console.log('   At 12:30 PM, lunch break is still available (10 AM - 1 PM)');
    console.log('   "Missed break" notifications should trigger every 30 minutes during the window');
    console.log('   Current logic might only trigger "missed" after window closes');
    
    console.log('\n✅ Missed break logic test completed!');
    
  } catch (error) {
    console.error('❌ Error in missed break logic test:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testMissedBreakLogic();
