#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakTime() {
  try {
    // Get time from command line argument or use current time
    const testTimeArg = process.argv[2];
    let testTime;
    
    if (testTimeArg) {
      // Parse different time formats
      if (testTimeArg.includes(':')) {
        // Format like "13:30" or "1:30 PM"
        const today = new Date().toISOString().split('T')[0]; // Get today's date
        if (testTimeArg.includes('PM') || testTimeArg.includes('AM')) {
          testTime = `${today} ${testTimeArg}`;
        } else {
          testTime = `${today} ${testTimeArg}:00`;
        }
      } else {
        testTime = testTimeArg;
      }
    } else {
      // Use current time
      testTime = new Date().toISOString();
    }
    
    console.log(`🧪 TESTING BREAK NOTIFICATIONS FOR: ${new Date(testTime).toLocaleString()}\n`);
    
    const userId = 2; // kyle.p@shoreagents.com
    
    // Test all break notification types including missed breaks
    const result = await pool.query(`
      SELECT 
        is_break_available_soon($1, 'Morning', $2::timestamp) as morning_available_soon,
        is_break_available_soon($1, 'Lunch', $2::timestamp) as lunch_available_soon,
        is_break_available_soon($1, 'Afternoon', $2::timestamp) as afternoon_available_soon,
        is_break_available($1, 'Morning', $2::timestamp) as morning_available,
        is_break_available($1, 'Lunch', $2::timestamp) as lunch_available,
        is_break_available($1, 'Afternoon', $2::timestamp) as afternoon_available,
        is_break_missed($1, 'Morning', $2::timestamp) as morning_missed,
        is_break_missed($1, 'Lunch', $2::timestamp) as lunch_missed,
        is_break_missed($1, 'Afternoon', $2::timestamp) as afternoon_missed,
        is_break_ending_soon($1, $2::timestamp) as ending_soon
    `, [userId, testTime]);
    
    const data = result.rows[0];
    
    console.log('📋 NOTIFICATION RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const notifications = [];
    
    // Check for breaks available soon (15 minutes before)
    if (data.morning_available_soon) {
      notifications.push({ type: 'available_soon', break: 'Morning', message: 'Morning break available in 15 minutes' });
    }
    if (data.lunch_available_soon) {
      notifications.push({ type: 'available_soon', break: 'Lunch', message: 'Lunch break available in 15 minutes' });
    }
    if (data.afternoon_available_soon) {
      notifications.push({ type: 'available_soon', break: 'Afternoon', message: 'Afternoon break available in 15 minutes' });
    }
    
    // Check for breaks currently available (at start time)
    if (data.morning_available) {
      notifications.push({ type: 'break_available', break: 'Morning', message: 'Morning break available now!' });
    }
    if (data.lunch_available) {
      notifications.push({ type: 'break_available', break: 'Lunch', message: 'Lunch break available now!' });
    }
    if (data.afternoon_available) {
      notifications.push({ type: 'break_available', break: 'Afternoon', message: 'Afternoon break available now!' });
    }
    
    // Check for missed breaks (every 30 minutes)
    if (data.morning_missed) {
      notifications.push({ type: 'missed_break', break: 'Morning', message: 'You have not taken your morning break yet!' });
    }
    if (data.lunch_missed) {
      notifications.push({ type: 'missed_break', break: 'Lunch', message: 'You have not taken your lunch break yet!' });
    }
    if (data.afternoon_missed) {
      notifications.push({ type: 'missed_break', break: 'Afternoon', message: 'You have not taken your afternoon break yet!' });
    }
    
    if (data.ending_soon) {
      // Determine which break is ending soon
      const windowsResult = await pool.query('SELECT * FROM calculate_break_windows($1)', ['6:00 AM - 3:00 PM']);
      const windows = windowsResult.rows[0];
      
      const currentTime = new Date(testTime).toTimeString().split(' ')[0];
      const checkTimes = [
        { type: 'Morning', end: windows.morning_end },
        { type: 'Lunch', end: windows.lunch_end },
        { type: 'Afternoon', end: windows.afternoon_end }
      ];
      
      let endingBreakType = 'Lunch'; // Default fallback
      for (const check of checkTimes) {
        const endTime = new Date('2025-08-18 ' + check.end);
        const testDateTime = new Date(testTime);
        const minutesUntilEnd = (endTime - testDateTime) / (1000 * 60);
        
        if (minutesUntilEnd > 0 && minutesUntilEnd <= 15) {
          endingBreakType = check.type;
          break;
        }
      }
      
      notifications.push({ type: 'ending_soon', break: endingBreakType, message: `${endingBreakType} break window closing in 15 minutes!` });
    }
    
    if (notifications.length === 0) {
      console.log('   ❌ No notifications would be sent at this time');
    } else {
      notifications.forEach((notif, i) => {
        const icon = notif.type === 'available_soon' ? '📢' : 
                    notif.type === 'break_available' ? '✅' :
                    notif.type === 'missed_break' ? '🚨' : '⏰';
        console.log(`   ${icon} ${notif.message}`);
        
        // Actually create the notification for testing
        if (i === 0) { // Only create the first one to avoid spam
          console.log('   🔔 Creating real notification...');
        }
      });
      
      // Create the first notification
      const firstNotif = notifications[0];
      await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
        [userId, firstNotif.type, firstNotif.break]);
      
      console.log('   ✅ Notification sent to your app!');
    }
    
    console.log('\n💡 USAGE EXAMPLES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   node scripts/test-break-time.js "7:45 AM"    # Test 7:45 AM (Morning break soon)');
    console.log('   node scripts/test-break-time.js "8:00 AM"    # Test 8:00 AM (Morning break starts)');
    console.log('   node scripts/test-break-time.js "8:30 AM"    # Test 8:30 AM (Morning break missed)');
    console.log('   node scripts/test-break-time.js "9:45 AM"    # Test 9:45 AM (Lunch break soon)');
    console.log('   node scripts/test-break-time.js "10:00 AM"   # Test 10:00 AM (Lunch break starts)');
    console.log('   node scripts/test-break-time.js "10:30 AM"   # Test 10:30 AM (Lunch break missed)');
    console.log('   node scripts/test-break-time.js "12:45 PM"   # Test 12:45 PM (Lunch break ending soon)');
    console.log('   node scripts/test-break-time.js "1:30 PM"    # Test 1:30 PM (Afternoon break soon)');
    console.log('   node scripts/test-break-time.js "1:45 PM"    # Test 1:45 PM (Afternoon break starts)');
    console.log('   node scripts/test-break-time.js "2:15 PM"    # Test 2:15 PM (Afternoon break missed)');
    console.log('   node scripts/test-break-time.js              # Test current time');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testBreakTime();
