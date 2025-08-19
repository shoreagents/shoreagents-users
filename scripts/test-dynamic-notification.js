const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testDynamicNotification() {
  try {
    console.log('🧪 Testing Dynamic Notification Messages...\n');
    
    // Test at 12:45 PM when lunch break should be ending soon (lunch ends at 1:00 PM)
    const testTime = '2025-08-19 12:45:00';
    console.log(`1️⃣ Testing at ${testTime} (lunch break should be ending soon)`);
    
    // First, check what break windows we have for User 2
    console.log('\n   Checking break windows for User 2:');
    const user2ShiftInfo = await pool.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (user2ShiftInfo.rows.length > 0) {
      const shiftInfo = user2ShiftInfo.rows[0];
      console.log(`     Shift Time: ${shiftInfo.shift_time}`);
      
      // Get break windows
      const breakWindows = await pool.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [shiftInfo.shift_time]);
      
      if (breakWindows.rows.length > 0) {
        const windows = breakWindows.rows[0];
        console.log(`     Morning: ${windows.morning_start} - ${windows.morning_end}`);
        console.log(`     Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
        console.log(`     Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
        
        // Check if lunch break is ending soon at 12:45 PM
        const lunchEndTime = windows.lunch_end;
        const testTimeObj = new Date(testTime);
        const lunchEndObj = new Date(`2025-08-19 ${lunchEndTime}`);
        
        const minutesUntilEnd = Math.floor((lunchEndObj - testTimeObj) / (1000 * 60));
        console.log(`     At 12:45 PM, lunch break ends in ${minutesUntilEnd} minutes`);
        
        if (minutesUntilEnd <= 15 && minutesUntilEnd > 0) {
          console.log('     ✅ This should trigger "ending soon" notification');
        } else {
          console.log('     ❌ This should NOT trigger "ending soon" notification');
        }
      }
    }
    
    // Test the is_break_ending_soon function
    console.log('\n2️⃣ Testing is_break_ending_soon at 12:45 PM:');
    const endingSoon = await pool.query(`
      SELECT is_break_ending_soon(2, $1::timestamp without time zone) as ending_soon
    `, [testTime]);
    
    console.log(`     Result: ${endingSoon.rows[0].ending_soon}`);
    
    // Now test creating a notification
    console.log('\n3️⃣ Testing notification creation:');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Create a test notification
    const testResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'ending_soon')
    `);
    
    console.log('     ✅ Function executed successfully');
    
    // Check the created notification
    const newNotifications = await pool.query(`
      SELECT 
        title,
        message,
        created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND type = 'warning'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (newNotifications.rows.length > 0) {
      const notification = newNotifications.rows[0];
      console.log('\n   📢 New notification created:');
      console.log(`     Title: ${notification.title}`);
      console.log(`     Message: ${notification.message}`);
      console.log(`     Time: ${notification.created_at.toLocaleString()}`);
      
      // Analyze the message
      if (notification.message.includes('Lunch')) {
        console.log('     ✅ Message shows correct break type: Lunch');
      } else if (notification.message.includes('Morning')) {
        console.log('     ✅ Message shows correct break type: Morning');
      } else if (notification.message.includes('Afternoon')) {
        console.log('     ✅ Message shows correct break type: Afternoon');
      } else {
        console.log('     ❌ Message shows generic break type');
      }
      
      if (notification.message.includes('15 minutes')) {
        console.log('     ✅ Message shows correct timing: 15 minutes');
      } else if (notification.message.includes('14 minutes')) {
        console.log('     ✅ Message shows correct timing: 14 minutes');
      } else if (notification.message.includes('13 minutes')) {
        console.log('     ✅ Message shows correct timing: 13 minutes');
      } else if (notification.message.includes('will end soon')) {
        console.log('     ✅ Message shows generic "will end soon"');
      } else {
        console.log('     ❌ Message shows unexpected timing');
      }
      
      // Check if it's the old hardcoded message
      if (notification.message.includes('5 minutes')) {
        console.log('     ❌ Still has old hardcoded "5 minutes" message');
      } else {
        console.log('     ✅ No more hardcoded "5 minutes" message');
      }
      
    } else {
      console.log('     ❌ No notification was created');
    }
    
    // Summary
    console.log('\n✅ Dynamic notification test completed!');
    
  } catch (error) {
    console.error('❌ Error testing dynamic notification:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testDynamicNotification();
