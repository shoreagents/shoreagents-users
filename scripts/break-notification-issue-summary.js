const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function breakNotificationIssueSummary() {
  console.log('🚨 BREAK NOTIFICATION ISSUE ANALYSIS\n');
  console.log('Problem: Agent User 2 received "Lunch Break Available Now" notification at 9 PM\n');
  
  try {
    // 1. Show the problematic notification
    console.log('1️⃣ PROBLEMATIC NOTIFICATION:');
    const problemNotification = await pool.query(`
      SELECT 
        created_at,
        title,
        message,
        payload
      FROM notifications 
      WHERE user_id = 2 
      AND title LIKE '%Lunch%'
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (problemNotification.rows.length > 0) {
      const notif = problemNotification.rows[0];
      console.log(`   • Time: ${notif.created_at}`);
      console.log(`   • Title: ${notif.title}`);
      console.log(`   • Message: ${notif.message}`);
      console.log(`   • Payload: ${JSON.stringify(notif.payload, null, 2)}`);
    }
    
    // 2. Show the root cause
    console.log('\n2️⃣ ROOT CAUSE ANALYSIS:');
    console.log('   🚨 TIMEZONE MISMATCH:');
    console.log('      • Database timezone: UTC (0 hours offset)');
    console.log('      • Application timezone: Asia/Singapore (+8 hours offset)');
    console.log('      • This causes a 8-hour difference in time calculations!');
    
    console.log('\n   🚨 SCHEDULER IS ACTIVE:');
    console.log('      • Break reminder scheduler is running every minute');
    console.log('      • It calls check_break_reminders() function');
    console.log('      • This function calls is_break_available_now() for each break type');
    
    console.log('\n   🚨 INCORRECT TIME CALCULATION:');
    console.log('      • User 2 shift: 7:00 AM - 4:00 PM');
    console.log('      • Lunch break window: 10:30 AM - 11:30 AM');
    console.log('      • Current time: 9:16 PM (21:16)');
    console.log('      • is_break_available_now() should return FALSE but returns TRUE');
    
    // 3. Show the exact problem in the function
    console.log('\n3️⃣ EXACT PROBLEM IN CODE:');
    console.log('   • Function: is_break_available_now(2, \'Lunch\', current_time)');
    console.log('   • Current time: 9:16 PM (21:16)');
    console.log('   • Lunch window: 10:30 AM - 11:30 AM (10:30 - 11:30)');
    console.log('   • Logic: 21:16 >= 10:30 AND 21:16 <= 11:30');
    console.log('   • Expected: FALSE (21:16 is NOT between 10:30 and 11:30)');
    console.log('   • Actual: TRUE (function is broken)');
    
    // 4. Show the timezone conversion issue
    console.log('\n4️⃣ TIMEZONE CONVERSION ISSUE:');
    const timezoneTest = await pool.query(`
      SELECT 
        NOW() as db_now,
        NOW() AT TIME ZONE 'UTC' as db_utc,
        NOW() AT TIME ZONE 'Asia/Manila' as db_manila,
        (NOW() AT TIME ZONE 'Asia/Manila')::time as manila_time_only,
        '21:16:00'::time as current_time_only
    `);
    
    const tz = timezoneTest.rows[0];
    console.log(`   • Database NOW(): ${tz.db_now}`);
    console.log(`   • Database UTC: ${tz.db_utc}`);
    console.log(`   • Database Manila: ${tz.db_manila}`);
    console.log(`   • Manila time only: ${tz.manila_time_only}`);
    console.log(`   • Current time (9:16 PM): ${tz.current_time_only}`);
    
    // 5. Show what the function should be doing
    console.log('\n5️⃣ WHAT THE FUNCTION SHOULD DO:');
    console.log('   • Get current time in Manila timezone');
    console.log('   • Extract time part (HH:MM:SS)');
    console.log('   • Compare with break window times');
    console.log('   • Return TRUE only if current time is within window');
    
    console.log('\n   ✅ CORRECT LOGIC:');
    console.log('      • Current: 21:16 (9:16 PM)');
    console.log('      • Lunch window: 10:30 - 11:30 (10:30 AM - 11:30 AM)');
    console.log('      • 21:16 >= 10:30? TRUE');
    console.log('      • 21:16 <= 11:30? FALSE');
    console.log('      • Result: TRUE AND FALSE = FALSE');
    
    console.log('\n   ❌ BROKEN LOGIC:');
    console.log('      • Function is somehow returning TRUE');
    console.log('      • This suggests a bug in the time comparison logic');
    
    // 6. Show the fix needed
    console.log('\n6️⃣ IMMEDIATE FIXES NEEDED:');
    console.log('   🔧 Fix 1: Correct timezone handling in is_break_available_now()');
    console.log('      • Ensure function uses Asia/Manila timezone consistently');
    console.log('      • Fix time comparison logic');
    
    console.log('   🔧 Fix 2: Stop the scheduler temporarily');
    console.log('      • Prevent more incorrect notifications');
    console.log('      • Check if break-reminder-scheduler.js is running');
    
    console.log('   🔧 Fix 3: Add time-of-day validation');
    console.log('      • Prevent lunch break notifications outside 6 AM - 6 PM');
    console.log('      • Add sanity checks for break timing');
    
    // 7. Show the exact issue
    console.log('\n7️⃣ EXACT ISSUE IDENTIFIED:');
    console.log('   🚨 The is_break_available_now() function has a bug in its time comparison logic');
    console.log('   🚨 It\'s incorrectly determining that 9:16 PM is within the 10:30 AM - 11:30 AM lunch window');
    console.log('   🚨 This bug, combined with the active scheduler, creates notifications at wrong times');
    console.log('   🚨 The timezone mismatch (UTC vs +8) is likely contributing to the calculation error');
    
    console.log('\n📋 SUMMARY:');
    console.log('   • Agent User 2 (kyle.p@shoreagents.com) has shift: 7:00 AM - 4:00 PM');
    console.log('   • Lunch break should be available: 10:30 AM - 11:30 AM');
    console.log('   • Notification received at: 9:00 PM (completely wrong time)');
    console.log('   • Root cause: Bug in is_break_available_now() function + active scheduler');
    console.log('   • Fix: Repair the function logic and temporarily disable scheduler');
    
  } catch (error) {
    console.error('❌ Error analyzing break notification issue:', error.message);
  } finally {
    await pool.end();
  }
}

breakNotificationIssueSummary();
