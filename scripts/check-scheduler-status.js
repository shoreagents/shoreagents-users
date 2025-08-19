const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkSchedulerStatus() {
  try {
    console.log('🔍 Checking Break Reminder Scheduler Status...\n');
    
    // 1. Check if the scheduler is running by looking at recent activity
    console.log('1️⃣ Checking scheduler activity:');
    
    console.log('   ℹ️ Cannot check function call statistics (pg_stat_statements not available)');
    console.log('   Will check notification patterns instead');
    
    // 2. Check if notifications are being created at regular intervals
    console.log('\n2️⃣ Checking notification creation patterns:');
    
    const notificationPatternResult = await pool.query(`
      SELECT 
        DATE_TRUNC('minute', created_at) as minute,
        COUNT(*) as notification_count,
        STRING_AGG(type, ', ') as types
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '2 hours'
      GROUP BY DATE_TRUNC('minute', created_at)
      ORDER BY minute DESC
      LIMIT 10
    `);
    
    if (notificationPatternResult.rows.length > 0) {
      console.log('   📊 Notification creation pattern:');
      notificationPatternResult.rows.forEach((pattern, index) => {
        console.log(`   ${index + 1}. ${pattern.minute.toLocaleString()}: ${pattern.notification_count} notifications (${pattern.types})`);
      });
    } else {
      console.log('   ❌ No recent notifications found');
    }
    
    // 3. Test the scheduler manually
    console.log('\n3️⃣ Testing scheduler manually:');
    
    // Call check_break_reminders manually
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      console.log(`   ✅ Manual call successful - Notifications sent: ${notificationsSent}`);
      
      if (notificationsSent > 0) {
        console.log('   🎉 Scheduler function is working!');
      } else {
        console.log('   ℹ️ No notifications sent (this might be normal)');
      }
    } catch (error) {
      console.log(`   ❌ Manual call failed: ${error.message}`);
    }
    
    // 4. Check if the issue is with the scheduler not running
    console.log('\n4️⃣ Scheduler diagnosis:');
    console.log('   The issue is likely that the break reminder scheduler is not running automatically');
    console.log('   Even though the socket server is running, the scheduler inside it might be broken');
    console.log('   ');
    console.log('   Solutions:');
    console.log('   1. Restart the socket server to restart the scheduler');
    console.log('   2. Check if the scheduler is actually running inside socket-server.js');
    console.log('   3. The scheduler should run every 2 minutes and call check_break_reminders()');
    
    // 5. Check current time and what should happen
    console.log('\n5️⃣ Current time analysis:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`   Current minute: ${now.getMinutes()}`);
    
    // Check if we're at a 30-minute interval
    const isAt30MinuteInterval = now.getMinutes() % 30 === 0;
    console.log(`   At 30-minute interval: ${isAt30MinuteInterval ? '✅ Yes' : '❌ No'}`);
    
    if (isAt30MinuteInterval) {
      console.log('   🎯 This should trigger a missed break notification!');
    } else {
      const minutesUntilNextInterval = 30 - (now.getMinutes() % 30);
      console.log(`   ⏰ Next 30-minute interval in ${minutesUntilNextInterval} minutes`);
    }
    
    console.log('\n✅ Scheduler status check completed!');
    
  } catch (error) {
    console.error('❌ Error in scheduler status check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkSchedulerStatus();
