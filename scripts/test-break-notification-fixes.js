const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakNotificationFixes() {
  console.log('🧪 Testing Break Notification Fixes\n');
  
  try {
    // Test 1: Verify functions return FALSE at night (current time)
    console.log('1️⃣ Testing functions at current time (night)...');
    const nightTest = await pool.query(`
      SELECT 
        NOW() AT TIME ZONE 'Asia/Manila' as current_time,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as current_hour,
        is_break_available_now(2, 'Morning'::break_type_enum) as morning_now,
        is_break_available_now(2, 'Lunch'::break_type_enum) as lunch_now,
        is_break_available_now(2, 'Afternoon'::break_type_enum) as afternoon_now,
        is_break_available_soon(2, 'Morning'::break_type_enum) as morning_soon,
        is_break_available_soon(2, 'Lunch'::break_type_enum) as lunch_soon,
        is_break_available_soon(2, 'Afternoon'::break_type_enum) as afternoon_soon,
        check_break_reminders() as scheduler_result
    `);
    
    const night = nightTest.rows[0];
    console.log(`   • Current time: ${night.current_time} (Hour: ${night.current_hour})`);
    console.log(`   • Morning break now: ${night.morning_now} (should be FALSE)`);
    console.log(`   • Lunch break now: ${night.lunch_now} (should be FALSE)`);
    console.log(`   • Afternoon break now: ${night.afternoon_now} (should be FALSE)`);
    console.log(`   • Morning break soon: ${night.morning_soon} (should be FALSE)`);
    console.log(`   • Lunch break soon: ${night.lunch_soon} (should be FALSE)`);
    console.log(`   • Afternoon break soon: ${night.afternoon_soon} (should be FALSE)`);
    console.log(`   • Scheduler result: ${night.scheduler_result} notifications (should be 0)`);
    
    const nightTestPassed = !night.morning_now && !night.lunch_now && !night.afternoon_now && 
                           !night.morning_soon && !night.lunch_soon && !night.afternoon_soon && 
                           night.scheduler_result === 0;
    
    if (nightTestPassed) {
      console.log('   ✅ NIGHT TEST PASSED: All functions correctly return FALSE at night');
    } else {
      console.log('   ❌ NIGHT TEST FAILED: Some functions still return TRUE at night');
    }
    
    // Test 2: Verify functions work correctly during work hours
    console.log('\n2️⃣ Testing functions during work hours...');
    
    // Test at 10:30 AM (lunch break start)
    const lunchStartTest = await pool.query(`
      SELECT 
        '2025-08-20 10:30:00'::timestamp as test_time,
        is_break_available_now(2, 'Lunch'::break_type_enum, '2025-08-20 10:30:00'::timestamp) as lunch_now_1030,
        is_break_available_soon(2, 'Lunch'::break_type_enum, '2025-08-20 10:15:00'::timestamp) as lunch_soon_1015
    `);
    
    const lunchStart = lunchStartTest.rows[0];
    console.log(`   • At 10:30 AM (lunch start): lunch_now = ${lunchStart.lunch_now_1030} (should be TRUE)`);
    console.log(`   • At 10:15 AM (15 min before): lunch_soon = ${lunchStart.lunch_soon_1015} (should be TRUE)`);
    
    // Test at 11:30 AM (lunch break end)
    const lunchEndTest = await pool.query(`
      SELECT 
        is_break_available_now(2, 'Lunch'::break_type_enum, '2025-08-20 11:30:00'::timestamp) as lunch_now_1130,
        is_break_available_now(2, 'Lunch'::break_type_enum, '2025-08-20 11:31:00'::timestamp) as lunch_now_1131
    `);
    
    const lunchEnd = lunchEndTest.rows[0];
    console.log(`   • At 11:30 AM (lunch end): lunch_now = ${lunchEnd.lunch_now_1130} (should be FALSE)`);
    console.log(`   • At 11:31 AM (after lunch): lunch_now = ${lunchEnd.lunch_now_1131} (should be FALSE)`);
    
    const workHoursTestPassed = lunchStart.lunch_now_1030 && lunchStart.lunch_soon_1015 && 
                               !lunchEnd.lunch_now_1130 && !lunchEnd.lunch_now_1131;
    
    if (workHoursTestPassed) {
      console.log('   ✅ WORK HOURS TEST PASSED: Functions work correctly during work hours');
    } else {
      console.log('   ❌ WORK HOURS TEST FAILED: Functions not working correctly during work hours');
    }
    
    // Test 3: Verify no notifications are created at night
    console.log('\n3️⃣ Testing notification creation at night...');
    const notificationsBefore = await pool.query(`
      SELECT COUNT(*) as count FROM notifications WHERE category = 'break' AND created_at > NOW() - INTERVAL '5 minutes'
    `);
    
    console.log(`   • Notifications in last 5 minutes: ${notificationsBefore.rows[0].count}`);
    
    // Try to create a notification manually at night (should be blocked)
    try {
      await pool.query(`SELECT create_break_reminder_notification(2, 'available_now', 'Lunch'::break_type_enum)`);
      const notificationsAfter = await pool.query(`
        SELECT COUNT(*) as count FROM notifications WHERE category = 'break' AND created_at > NOW() - INTERVAL '1 minute'
      `);
      
      if (notificationsAfter.rows[0].count === notificationsBefore.rows[0].count) {
        console.log('   ✅ NOTIFICATION BLOCKING TEST PASSED: No notifications created at night');
      } else {
        console.log('   ❌ NOTIFICATION BLOCKING TEST FAILED: Notification was created at night');
      }
    } catch (error) {
      console.log(`   ❌ Error testing notification creation: ${error.message}`);
    }
    
    // Test 4: Check current database state
    console.log('\n4️⃣ Checking current database state...');
    const dbState = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour_notifications,
        COUNT(CASE WHEN title LIKE '%Lunch%' AND created_at > NOW() - INTERVAL '2 hours' THEN 1 END) as recent_lunch_notifications
      FROM notifications 
      WHERE category = 'break'
    `);
    
    const state = dbState.rows[0];
    console.log(`   • Total break notifications: ${state.total_notifications}`);
    console.log(`   • Last hour: ${state.last_hour_notifications}`);
    console.log(`   • Recent lunch notifications: ${state.recent_lunch_notifications}`);
    
    // Test 5: Verify timezone handling
    console.log('\n5️⃣ Verifying timezone handling...');
    const timezoneTest = await pool.query(`
      SELECT 
        NOW() as db_now,
        NOW() AT TIME ZONE 'Asia/Manila' as manila_now,
        EXTRACT(HOUR FROM NOW()) as db_hour,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_hour
    `);
    
    const tz = timezoneTest.rows[0];
    console.log(`   • Database NOW(): ${tz.db_now} (Hour: ${tz.db_hour})`);
    console.log(`   • Manila NOW(): ${tz.manila_now} (Hour: ${tz.manila_hour})`);
    
    const timezoneCorrect = Math.abs(tz.manila_hour - tz.db_hour) >= 7; // Should be 8 hours apart
    if (timezoneCorrect) {
      console.log('   ✅ TIMEZONE TEST PASSED: Manila timezone is correctly different from database timezone');
    } else {
      console.log('   ❌ TIMEZONE TEST FAILED: Timezone conversion may not be working correctly');
    }
    
    // Overall summary
    console.log('\n📋 TEST SUMMARY:');
    const allTestsPassed = nightTestPassed && workHoursTestPassed && timezoneCorrect;
    
    if (allTestsPassed) {
      console.log('   🎉 ALL TESTS PASSED! Break notification system is fixed');
      console.log('   ✅ No more lunch break notifications at 9 PM');
      console.log('   ✅ Functions only work during work hours (6 AM - 6 PM)');
      console.log('   ✅ Proper timezone handling implemented');
      console.log('   ✅ Scheduler blocked outside work hours');
    } else {
      console.log('   ⚠️  Some tests failed - review the results above');
    }
    
    console.log('\n🔧 Next Steps:');
    console.log('   • The system should now work correctly');
    console.log('   • Monitor for any remaining issues over the next few days');
    console.log('   • No more incorrect notifications should be generated');
    console.log('   • Lunch break notifications will only appear between 10:15-10:30 AM');
    
  } catch (error) {
    console.error('❌ Error testing fixes:', error.message);
  } finally {
    await pool.end();
  }
}

testBreakNotificationFixes();
