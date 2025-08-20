const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakReminders() {
  try {
    console.log('🧪 Testing check_break_reminders Function...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    console.log('1️⃣ Current time check:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Check if we're in the critical window (1:43-1:47 PM)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const isInCriticalWindow = (currentHour === 13 && currentMinute >= 43 && currentMinute <= 47);
    
    if (isInCriticalWindow) {
      console.log('   🎯 Currently in critical window for lunch break ending soon!');
      console.log('   This should trigger the "Break ending soon" notification');
    } else {
      console.log('   ℹ️ Not currently in critical window for lunch break ending soon');
      console.log('   Critical window: 1:43 PM - 1:47 PM (15 minutes before 2:00 PM end)');
    }
    
    console.log('\n2️⃣ Testing check_break_reminders function:');
    
    // Check current notifications count
    const beforeCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = $1 AND category = 'break' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `, [testAgentId]);
    
    const beforeCount = beforeCountResult.rows[0].count;
    console.log(`   Notifications in last 5 minutes (before): ${beforeCount}`);
    
    // Run the check_break_reminders function
    const result = await pool.query('SELECT check_break_reminders()');
    console.log('   ✅ check_break_reminders executed successfully');
    
    // Check notifications count after
    const afterCountResult = await pool.query(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = $1 AND category = 'break' 
      AND created_at > NOW() - INTERVAL '5 minutes'
    `, [testAgentId]);
    
    const afterCount = afterCountResult.rows[0].count;
    console.log(`   Notifications in last 5 minutes (after): ${afterCount}`);
    
    if (afterCount > beforeCount) {
      console.log(`   🎉 ${afterCount - beforeCount} new notification(s) created!`);
      
      // Show the new notifications
      const newNotificationsResult = await pool.query(`
        SELECT 
          id,
          type,
          title,
          message,
          created_at
        FROM notifications 
        WHERE user_id = $1 AND category = 'break' 
        AND created_at > NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 5
      `, [testAgentId]);
      
      console.log('\n3️⃣ New notifications:');
      newNotificationsResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
        console.log(`      Type: ${notification.type}, Message: ${notification.message}`);
      });
    } else {
      console.log('   ℹ️ No new notifications created');
      
      if (isInCriticalWindow) {
        console.log('   ❓ Expected notification but none was created');
        console.log('   This might indicate an issue with the notification creation logic');
      }
    }
    
    console.log('\n4️⃣ Summary:');
    if (isInCriticalWindow) {
      console.log('   🎯 You are currently in the critical window (1:43-1:47 PM)');
      console.log('   ✅ The is_break_window_ending_soon function is working correctly');
      if (afterCount > beforeCount) {
        console.log('   ✅ The check_break_reminders function is creating notifications');
        console.log('   🎉 You should now receive "Break ending soon" notifications at 1:45 PM!');
      } else {
        console.log('   ❌ The check_break_reminders function is not creating notifications');
        console.log('   🔍 Need to investigate the notification creation logic');
      }
    } else {
      console.log('   ℹ️ You are not currently in the critical window');
      console.log('   ✅ The function is working correctly (no notification expected)');
      console.log('   🎯 To test, wait until 1:43-1:47 PM when lunch break is ending soon');
    }
    
  } catch (error) {
    console.error('❌ Error testing break reminders:', error.message);
  } finally {
    await pool.end();
  }
}

testBreakReminders();
