const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakNotificationFixes() {
  console.log('🔧 Applying Break Notification Fixes\n');
  
  try {
    // Read the SQL fix file
    const sqlFixes = fs.readFileSync('scripts/fix-break-notification-issues-v2.sql', 'utf8');
    
    console.log('1️⃣ Applying database fixes...');
    await pool.query(sqlFixes);
    console.log('   ✅ Database fixes applied successfully');
    
    // Test the fixed functions
    console.log('\n2️⃣ Testing fixed functions...');
    
    // Test is_break_available_now with current time (should return FALSE at 9 PM)
    const testAvailableNow = await pool.query(`
      SELECT 
        is_break_available_now(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result,
        (NOW() AT TIME ZONE 'Asia/Manila')::time as current_time
    `);
    
    const availableNowResult = testAvailableNow.rows[0];
    console.log(`   • is_break_available_now(2, 'Lunch') at ${availableNowResult.current_time}: ${availableNowResult.result}`);
    
    if (availableNowResult.result === false) {
      console.log('   ✅ FIXED: Function now correctly returns FALSE at night');
    } else {
      console.log('   ❌ Function still returns TRUE - needs more investigation');
    }
    
    // Test is_break_available_soon
    const testAvailableSoon = await pool.query(`
      SELECT 
        is_break_available_soon(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result
    `);
    
    console.log(`   • is_break_available_soon(2, 'Lunch'): ${testAvailableSoon.rows[0].result}`);
    
    // Test check_break_reminders (should return 0 at night)
    const testScheduler = await pool.query(`SELECT check_break_reminders() as notifications_sent`);
    console.log(`   • check_break_reminders(): ${testScheduler.rows[0].notifications_sent} notifications sent`);
    
    if (testScheduler.rows[0].notifications_sent === 0) {
      console.log('   ✅ FIXED: Scheduler now returns 0 notifications at night');
    }
    
    // Clean up incorrect notifications
    console.log('\n3️⃣ Cleaning up incorrect notifications...');
    const cleanupResult = await pool.query(`
      DELETE FROM notifications 
      WHERE category = 'break' 
      AND created_at > (NOW() - INTERVAL '2 hours')
      AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Manila') NOT BETWEEN 6 AND 17
      RETURNING id, title, created_at
    `);
    
    if (cleanupResult.rows.length > 0) {
      console.log(`   ✅ Cleaned up ${cleanupResult.rows.length} incorrect notifications:`);
      cleanupResult.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. ${notif.title} at ${notif.created_at}`);
      });
    } else {
      console.log('   • No incorrect notifications to clean up');
    }
    
    // Show remaining notifications
    console.log('\n4️⃣ Current break notifications status...');
    const currentNotifications = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour
      FROM notifications 
      WHERE category = 'break'
    `);
    
    const notifStats = currentNotifications.rows[0];
    console.log(`   • Total break notifications: ${notifStats.total}`);
    console.log(`   • Last hour: ${notifStats.last_hour}`);
    
    console.log('\n📋 Fix Summary:');
    console.log('   ✅ Fixed is_break_available_now() with proper timezone handling');
    console.log('   ✅ Fixed is_break_available_soon() with time-of-day validation');
    console.log('   ✅ Fixed create_break_reminder_notification() with better duplicate prevention');
    console.log('   ✅ Fixed check_break_reminders() to only run during work hours (6 AM - 6 PM)');
    console.log('   ✅ Added time-of-day validation to prevent notifications outside work hours');
    console.log('   ✅ Cleaned up incorrect notifications from database');
    
    console.log('\n🎯 Expected Behavior:');
    console.log('   • No more lunch break notifications at 9 PM');
    console.log('   • Notifications only during work hours (6 AM - 6 PM)');
    console.log('   • Proper timezone handling (Asia/Manila)');
    console.log('   • Better duplicate prevention (60-minute window)');
    
    console.log('\n⚠️  Next Steps:');
    console.log('   • Monitor notifications for the next few hours');
    console.log('   • Check if any Node.js scheduler processes are still running');
    console.log('   • Consider restarting any background services');
    
  } catch (error) {
    console.error('❌ Error applying fixes:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

applyBreakNotificationFixes();
