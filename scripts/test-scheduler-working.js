const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testSchedulerWorking() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing if the break scheduler is now working...\n');
    
    // 1. Check if notifications are being created
    console.log('1️⃣ Checking for recent notifications...');
    
    const recentNotifications = await client.query(`
      SELECT 
        id,
        user_id,
        title,
        message,
        category,
        payload,
        created_at
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentNotifications.rows.length > 0) {
      console.log('   📢 Recent break notifications found:');
      recentNotifications.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. User ${notif.user_id} - ${notif.title}`);
        console.log(`        Message: ${notif.message}`);
        console.log(`        Payload: ${JSON.stringify(notif.payload)}`);
        console.log(`        Time: ${notif.created_at.toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   ℹ️ No recent break notifications found (scheduler may not have run yet)');
    }
    
    // 2. Test manual notification trigger
    console.log('2️⃣ Testing manual notification trigger...');
    
    const reminderResult = await client.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    
    console.log(`   ✅ Manual trigger: ${notificationsSent} notifications sent`);
    
    // 3. Check if new notifications were created
    console.log('\n3️⃣ Checking for new notifications after manual trigger...');
    
    const newNotifications = await client.query(`
      SELECT 
        id,
        user_id,
        title,
        message,
        payload,
        created_at
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (newNotifications.rows.length > 0) {
      console.log('   📢 New notifications created:');
      newNotifications.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. User ${notif.user_id} - ${notif.title}`);
        console.log(`        Message: ${notif.message}`);
        console.log(`        Payload: ${JSON.stringify(notif.payload)}`);
        console.log(`        Time: ${notif.created_at.toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   ℹ️ No new notifications created (may be outside notification windows)');
    }
    
    // 4. Test specific time scenarios
    console.log('4️⃣ Testing specific notification scenarios...');
    
    // Test at 11:00 AM (lunch break starts for User 2)
    const testTime = '2025-01-20 11:00:00';
    console.log(`   Testing at ${testTime} (should trigger "available now" for lunch):`);
    
    const availableNow = await client.query(`
      SELECT is_break_available_now(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    console.log(`     Available now: ${availableNow.rows[0].result}`);
    
    // Test at 10:45 AM (15 min before lunch)
    const testTime2 = '2025-01-20 10:45:00';
    console.log(`   Testing at ${testTime2} (should trigger "available soon" for lunch):`);
    
    const availableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [testTime2]);
    
    console.log(`     Available soon: ${availableSoon.rows[0].result}`);
    
    // 5. Check scheduler process
    console.log('\n5️⃣ Checking scheduler process status...');
    
    try {
      const { exec } = require('child_process');
      exec('ps aux | grep "break-reminder-scheduler" | grep -v grep', (error, stdout, stderr) => {
        if (stdout) {
          console.log('   ✅ Scheduler process is running:');
          console.log(`      ${stdout.trim()}`);
        } else {
          console.log('   ❌ Scheduler process not found');
        }
      });
    } catch (error) {
      console.log(`   Error checking process: ${error.message}`);
    }
    
    // 6. Summary
    console.log('\n🎯 Summary:');
    if (newNotifications.rows.length > 0) {
      console.log('   ✅ Scheduler is working! Notifications are being created.');
      console.log('   🔔 You should now receive notifications at the right times.');
    } else {
      console.log('   ⚠️ Scheduler may not be working yet or no notifications are due.');
      console.log('   💡 Wait a few minutes for the scheduler to run, or check the logs.');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing scheduler:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testSchedulerWorking();
