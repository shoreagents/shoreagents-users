const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function test11amNotifications() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing 11:00 AM notifications for User 2...\n');
    
    // 1. Check current shift time
    console.log('1️⃣ Current User 2 shift configuration:');
    const currentShift = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 2
    `);
    
    if (currentShift.rows.length > 0) {
      console.log(`   Shift Time: ${currentShift.rows[0].shift_time}`);
      console.log(`   Shift Period: ${currentShift.rows[0].shift_period}`);
      console.log(`   Last Updated: ${currentShift.rows[0].updated_at}`);
    }
    
    // 2. Calculate break windows
    console.log('\n2️⃣ Break windows for current shift:');
    const breakWindows = await client.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [currentShift.rows[0].shift_time]);
    
    if (breakWindows.rows.length > 0) {
      const windows = breakWindows.rows[0];
      console.log(`   Morning: ${windows.morning_start} - ${windows.morning_end}`);
      console.log(`   Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
      console.log(`   Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
    }
    
    // 3. Test notification functions at 11:00 AM
    console.log('\n3️⃣ Testing notification functions at 11:00 AM:');
    const testTime = '2025-01-20 11:00:00';
    console.log(`   Test time: ${testTime}`);
    
    // Test all notification types
    const availableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    const availableNow = await client.query(`
      SELECT is_break_available_now(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    const reminderDue = await client.query(`
      SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    const endingSoon = await client.query(`
      SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    console.log(`   Available soon (15 min before): ${availableSoon.rows[0].result}`);
    console.log(`   Available now (during window): ${availableNow.rows[0].result}`);
    console.log(`   30-min reminder: ${reminderDue.rows[0].result}`);
    console.log(`   Ending soon (15 min before end): ${endingSoon.rows[0].result}`);
    
    // 4. Test at different times around 11:00 AM
    console.log('\n4️⃣ Testing at different times around 11:00 AM:');
    
    const testTimes = [
      { time: '2025-01-20 10:45:00', desc: '10:45 AM (15 min before lunch)' },
      { time: '2025-01-20 11:00:00', desc: '11:00 AM (lunch starts)' },
      { time: '2025-01-20 11:30:00', desc: '11:30 AM (30 min into lunch)' },
      { time: '2025-01-20 12:00:00', desc: '12:00 PM (1 hour into lunch)' },
      { time: '2025-01-20 12:30:00', desc: '12:30 PM (1.5 hours into lunch)' },
      { time: '2025-01-20 13:45:00', desc: '1:45 PM (15 min before lunch ends)' }
    ];
    
    for (const test of testTimes) {
      console.log(`\n   Testing at ${test.desc}:`);
      
      const availableSoon = await client.query(`
        SELECT is_break_available_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
      `, [test.time]);
      
      const availableNow = await client.query(`
        SELECT is_break_available_now(2, 'Lunch'::break_type_enum, $1::timestamp) as result
      `, [test.time]);
      
      const reminderDue = await client.query(`
        SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, $1::timestamp) as result
      `, [test.time]);
      
      const endingSoon = await client.query(`
        SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
      `, [test.time]);
      
      console.log(`     Available soon: ${availableSoon.rows[0].result}`);
      console.log(`     Available now: ${availableNow.rows[0].result}`);
      console.log(`     30-min reminder: ${reminderDue.rows[0].result}`);
      console.log(`     Ending soon: ${endingSoon.rows[0].result}`);
    }
    
    // 5. Test the full notification system
    console.log('\n5️⃣ Testing full notification system at 11:00 AM:');
    
    // Clear recent notifications
    await client.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `);
    
    // Test check_break_reminders function
    const reminderResult = await client.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    
    console.log(`   check_break_reminders executed - Notifications sent: ${notificationsSent}`);
    
    // Check what notifications were created
    const recentNotifications = await client.query(`
      SELECT title, message, payload->>'reminder_type' as reminder_type, created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
    `);
    
    if (recentNotifications.rows.length > 0) {
      console.log(`   📢 Recent notifications created:`);
      recentNotifications.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. ${notif.title} (${notif.reminder_type})`);
        console.log(`        Message: ${notif.message}`);
        console.log(`        Time: ${notif.created_at.toLocaleString()}`);
      });
    } else {
      console.log(`   ℹ️ No recent notifications created (may be outside notification windows)`);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing 11:00 AM notifications:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
test11amNotifications();
