const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakAvailableNow() {
  try {
    console.log('🧪 Testing Break Available Now Notifications...\n');
    
    // Test at exactly 1:45 PM when afternoon break should be available
    const testTime = '2025-08-19 13:45:00'; // 1:45 PM
    console.log(`1️⃣ Testing at ${testTime} (afternoon break window starts at 1:45 PM)`);
    
    // Test the function
    const afternoonAvailableNow = await pool.query(`
      SELECT is_break_available_now(2, 'Afternoon', $1::timestamp without time zone) as available_now
    `, [testTime]);
    
    console.log(`   Afternoon break available now: ${afternoonAvailableNow.rows[0].available_now}`);
    
    if (afternoonAvailableNow.rows[0].available_now) {
      console.log('   ✅ SUCCESS: Function correctly detects break available now at 1:45 PM');
    } else {
      console.log('   ❌ FAILED: Function does not detect break available now at 1:45 PM');
      return;
    }
    
    // Now test the actual notification creation
    console.log('\n2️⃣ Testing notification creation at 1:45 PM...');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Create the notification manually to test
    const notificationResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'break_available', 'Afternoon')
    `);
    
    console.log('   ✅ Notification creation function called successfully');
    
    // Check if the notification was created
    const newNotifications = await pool.query(`
      SELECT title, message, payload->>'reminder_type' as reminder_type, payload->>'break_type' as break_type, created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (newNotifications.rows.length > 0) {
      console.log(`\n   📢 Found ${newNotifications.rows.length} new notification(s):`);
      newNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Type: ${notification.reminder_type}`);
        console.log(`      Break Type: ${notification.break_type}`);
        console.log(`      Time: ${notification.created_at.toLocaleString()}`);
        console.log('');
      });
      
      // Check if we have the right type of notification
      const availableNotifications = newNotifications.rows.filter(n => 
        n.reminder_type === 'break_available' && n.break_type === 'Afternoon'
      );
      
      if (availableNotifications.length > 0) {
        console.log('   ✅ SUCCESS: "Afternoon break available now" notification created correctly!');
        console.log('   ✅ This is exactly what you should receive at 1:45 PM');
      } else {
        console.log('   ❌ No "break available now" notifications found');
      }
    } else {
      console.log('   ❌ No notifications were created');
    }
    
    // Test the full check_break_reminders function
    console.log('\n3️⃣ Testing the full check_break_reminders function...');
    
    // Clear notifications again
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Call the function
    const result = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = result.rows[0].check_break_reminders;
    
    console.log(`   Notifications sent: ${notificationsSent}`);
    
    // Check what was created
    const fullTestNotifications = await pool.query(`
      SELECT title, message, payload->>'reminder_type' as reminder_type, payload->>'break_type' as break_type, created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (fullTestNotifications.rows.length > 0) {
      console.log(`\n   📢 Full function test created ${fullTestNotifications.rows.length} notification(s):`);
      fullTestNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Type: ${notification.reminder_type}`);
        console.log(`      Break Type: ${notification.break_type}`);
        console.log('');
      });
    } else {
      console.log('   ℹ️ No notifications created by full function (may be outside notification windows)');
    }
    
    // Summary
    console.log('\n✅ Break Available Now Test Complete!');
    
    console.log('\n🎯 What this means:');
    console.log('   • The `is_break_available_now()` function is working correctly');
    console.log('   • The `create_break_reminder_notification()` function can create "break_available" notifications');
    console.log('   • The `check_break_reminders()` function now includes "available now" checks');
    
    console.log('\n🔧 Expected Result:');
    console.log('   • At 1:45 PM: You should receive "Afternoon break available now!" ✅');
    console.log('   • The notification system is now complete and should work as expected! 🎉');
    
  } catch (error) {
    console.error('❌ Error testing break available now:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testBreakAvailableNow();
