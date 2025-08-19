const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakReminders() {
  try {
    console.log('🧪 Testing Break Reminder System\n');
    
    // Test 1: Get agent shift info
    console.log('1️⃣ Testing get_agent_shift_info()...');
    const shiftResult = await pool.query('SELECT * FROM get_agent_shift_info(2)');
    if (shiftResult.rows.length > 0) {
      const shift = shiftResult.rows[0];
      console.log(`✅ Agent shift info: ${shift.shift_time} (${shift.shift_period})`);
    } else {
      console.log('❌ No shift info found for agent');
    }
    
    // Test 2: Calculate break windows
    console.log('\n2️⃣ Testing calculate_break_windows()...');
    const testShifts = [
      '6:00 AM - 3:00 PM',
      '10:00 PM - 7:00 AM',
      '2:00 PM - 11:00 PM'
    ];
    
    for (const shiftTime of testShifts) {
      const windowsResult = await pool.query('SELECT * FROM calculate_break_windows($1)', [shiftTime]);
      if (windowsResult.rows.length > 0) {
        const w = windowsResult.rows[0];
        console.log(`✅ ${shiftTime}:`);
        console.log(`   Morning: ${w.morning_start} - ${w.morning_end}`);
        console.log(`   Lunch: ${w.lunch_start} - ${w.lunch_end}`);
        console.log(`   Afternoon: ${w.afternoon_start} - ${w.afternoon_end}`);
      }
    }
    
    // Test 3: Check current break availability
    console.log('\n3️⃣ Testing break availability checks...');
    const currentTime = new Date();
    const agents = await pool.query('SELECT id FROM users WHERE user_type = \'Agent\' LIMIT 3');
    
    for (const agent of agents.rows) {
      console.log(`\n👤 Agent ${agent.id}:`);
      
      const breakTypes = ['Morning', 'Lunch', 'Afternoon'];
      for (const breakType of breakTypes) {
        try {
          const availableResult = await pool.query(
            'SELECT is_break_available_soon($1, $2, $3)',
            [agent.id, breakType, currentTime]
          );
          const available = availableResult.rows[0].is_break_available_soon;
          console.log(`   ${breakType}: ${available ? '🟡 Available soon' : '⚪ Not available soon'}`);
        } catch (error) {
          console.log(`   ${breakType}: ❌ Error - ${error.message}`);
        }
      }
      
      // Check if break is ending soon
      try {
        const endingResult = await pool.query(
          'SELECT is_break_ending_soon($1, $2)',
          [agent.id, currentTime]
        );
        const ending = endingResult.rows[0].is_break_ending_soon;
        console.log(`   Current break: ${ending ? '🔴 Ending soon' : '⚪ Not ending soon'}`);
      } catch (error) {
        console.log(`   Current break: ❌ Error - ${error.message}`);
      }
    }
    
    // Test 4: Run full reminder check
    console.log('\n4️⃣ Testing full reminder check...');
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    console.log(`✅ Reminder check completed: ${notificationsSent} notifications sent`);
    
    // Test 5: Check recent notifications
    console.log('\n5️⃣ Checking recent break notifications...');
    const notificationsResult = await pool.query(`
      SELECT user_id, title, message, created_at 
      FROM notifications 
      WHERE category = 'break' 
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (notificationsResult.rows.length > 0) {
      console.log(`✅ Found ${notificationsResult.rows.length} recent break notifications:`);
      notificationsResult.rows.forEach((notif, index) => {
        console.log(`   ${index + 1}. User ${notif.user_id}: ${notif.title}`);
        console.log(`      "${notif.message}" (${new Date(notif.created_at).toLocaleTimeString()})`);
      });
    } else {
      console.log('ℹ️ No recent break notifications found');
    }
    
    console.log('\n🎉 Break reminder system test completed!');
    console.log('\n💡 How it works:');
    console.log('   • Checks every 2 minutes for all agents');
    console.log('   • Sends "available soon" notifications 15 minutes before break starts');
    console.log('   • Sends "ending soon" notifications 5 minutes before break ends');
    console.log('   • Uses dynamic timing based on agent shift times from job_info table');
    console.log('   • Prevents duplicate notifications within 30 minutes');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
  }
}

testBreakReminders();
