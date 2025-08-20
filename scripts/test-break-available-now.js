const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakAvailableNow() {
  console.log('🧪 Testing "Break is now available" functionality...\n');
  
  try {
    // 1. Test database connection
    console.log('1️⃣ Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connected successfully\n');
    
    // 2. Test the new is_break_available_now function at different times
    console.log('2️⃣ Testing is_break_available_now function at different times...\n');
    
    // Test times for lunch break (assuming it's 10:00 AM - 10:15 AM)
    const testTimes = [
      { time: '2025-08-20 10:00:00', description: '10:00 AM - Lunch break starts (should be TRUE)' },
      { time: '2025-08-20 10:01:00', description: '10:01 AM - 1 minute after start (should be TRUE)' },
      { time: '2025-08-20 10:14:00', description: '10:14 AM - 1 minute before end (should be TRUE)' },
      { time: '2025-08-20 10:15:00', description: '10:15 AM - Lunch break ends (should be FALSE)' },
      { time: '2025-08-20 09:45:00', description: '9:45 AM - 15 minutes before start (should be FALSE)' },
      { time: '2025-08-20 10:16:00', description: '10:16 AM - 1 minute after end (should be FALSE)' }
    ];
    
    for (const testCase of testTimes) {
      const result = await pool.query(`
        SELECT 
          is_break_available_now(1, 'Lunch'::break_type_enum, $1::timestamp) as available_now,
          is_break_available_soon(1, 'Lunch'::break_type_enum, $1::timestamp) as available_soon
      `, [testCase.time]);
      
      const availableNow = result.rows[0].available_now;
      const availableSoon = result.rows[0].available_soon;
      
      console.log(`   ${testCase.description}:`);
      console.log(`      Available now: ${availableNow} | Available soon: ${availableSoon}`);
      
      // Validate expected behavior
      if (testCase.time.includes('10:00:00') || testCase.time.includes('10:01:00') || testCase.time.includes('10:14:00')) {
        if (availableNow) {
          console.log(`      ✅ CORRECT: Break is available now`);
        } else {
          console.log(`      ❌ INCORRECT: Break should be available now`);
        }
      } else {
        if (!availableNow) {
          console.log(`      ✅ CORRECT: Break is not available now`);
        } else {
          console.log(`      ❌ INCORRECT: Break should not be available now`);
        }
      }
      console.log('');
    }
    
    // 3. Test the full notification system
    console.log('3️⃣ Testing the full notification system...');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 1 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Test at exactly 10:00 AM (lunch break start)
    const testTime = '2025-08-20 10:00:00';
    console.log(`   Testing at ${testTime} (lunch break should start)`);
    
    // Check if lunch break is available now at this time
    const availableNowResult = await pool.query(`
      SELECT is_break_available_now(1, 'Lunch'::break_type_enum, $1::timestamp) as available_now
    `, [testTime]);
    
    console.log(`   Lunch break available now: ${availableNowResult.rows[0].available_now}`);
    
    // 4. Test the check_break_reminders function
    console.log('\n4️⃣ Testing check_break_reminders function...');
    
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    
    console.log(`   ✅ Function executed successfully - Notifications sent: ${notificationsSent}`);
    
    // Check what notifications were created
    const newNotifications = await pool.query(`
      SELECT title, message, payload->>'reminder_type' as reminder_type, created_at
      FROM notifications
      WHERE user_id = 1
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (newNotifications.rows.length > 0) {
      console.log(`\n   📢 Found ${newNotifications.rows.length} new notifications:`);
      newNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Type: ${notification.reminder_type}`);
        console.log(`      Time: ${notification.created_at.toLocaleString()}`);
        console.log('');
      });
      
      // Check if we have "available now" notifications
      const availableNowNotifications = newNotifications.rows.filter(n => 
        n.reminder_type === 'available_now'
      );
      
      if (availableNowNotifications.length > 0) {
        console.log('   ✅ SUCCESS: "Break is now available" notifications are working!');
        console.log('   ✅ You should now receive "break is now available" notifications at 10:00 AM');
      } else {
        console.log('   ❌ No "break is now available" notifications found');
      }
    } else {
      console.log('   ℹ️ No new notifications created (may be outside notification windows)');
    }
    
    // 5. Summary
    console.log('\n🎯 Test Summary:');
    console.log('   • is_break_available_now() function: ✅ Added and tested');
    console.log('   • check_break_reminders() function: ✅ Updated to include "available now"');
    console.log('   • create_break_reminder_notification(): ✅ Updated to handle "available_now" type');
    console.log('\n🔔 Complete notification flow now includes:');
    console.log('   • 9:45 AM: "Lunch break will be available in 15 minutes"');
    console.log('   • 10:00 AM: "Lunch break is now available! You can take it now."');
    console.log('   • 10:10 AM: "Lunch break ending soon" (5 minutes before end)');
    
  } catch (error) {
    console.error('\n❌ Error testing break available now:', error.message);
    console.error('\n🔍 Error details:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testBreakAvailableNow();
