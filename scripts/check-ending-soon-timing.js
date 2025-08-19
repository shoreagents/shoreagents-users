const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkEndingSoonTiming() {
  try {
    console.log('🔍 Checking "Break Ending Soon" Notification Timing...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check current time and break window
    console.log('1️⃣ Current time and break window:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Get break windows for 6:00 AM - 3:00 PM shift
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows('6:00 AM - 3:00 PM')
    `);
    
    const lunchStart = breakWindowsResult.rows[0].lunch_start;
    const lunchEnd = breakWindowsResult.rows[0].lunch_end;
    
    console.log(`   Lunch break window: ${lunchStart} - ${lunchEnd}`);
    console.log(`   Lunch break ends at: ${lunchEnd} (1:00 PM)`);
    
    // 2. Check the is_break_ending_soon function logic
    console.log('\n2️⃣ Checking is_break_ending_soon function logic:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_ending_soon'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for the timing logic
      if (source.includes('INTERVAL \'15 minutes\'')) {
        console.log('\n   📍 Found 15-minute logic for ending soon');
        console.log('   ✅ "Break ending soon" triggers 15 minutes before break window ends');
      } else if (source.includes('INTERVAL \'5 minutes\'')) {
        console.log('\n   📍 Found 5-minute logic for ending soon');
        console.log('   ✅ "Break ending soon" triggers 5 minutes before break window ends');
      } else {
        console.log('\n   ❓ Could not determine exact timing from function source');
      }
    } else {
      console.log('   ❌ Function is_break_ending_soon not found');
    }
    
    // 3. Test the function at different times to see when it triggers
    console.log('\n3️⃣ Testing is_break_ending_soon at different times:');
    
    const testTimes = [
      '2025-08-19 12:30:00', // 12:30 PM - 30 min before end
      '2025-08-19 12:35:00', // 12:35 PM - 25 min before end
      '2025-08-19 12:40:00', // 12:40 PM - 20 min before end
      '2025-08-19 12:45:00', // 12:45 PM - 15 min before end (current time)
      '2025-08-19 12:50:00', // 12:50 PM - 10 min before end
      '2025-08-19 12:55:00', // 12:55 PM - 5 min before end
      '2025-08-19 13:00:00', // 1:00 PM - break window ends
    ];
    
    for (const testTime of testTimes) {
      try {
        const result = await pool.query(`
          SELECT 
            is_break_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
        `, [testAgentId, testTime]);
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        const isEndingSoon = result.rows[0].lunch_ending_soon;
        const minutesBeforeEnd = getMinutesBeforeEnd(testTime, '13:00:00');
        
        console.log(`   ${timeLabel} (${minutesBeforeEnd} min before end): ${isEndingSoon ? '✅ ENDING SOON' : '❌ Not ending soon'}`);
        
        // Highlight the current time
        if (timeLabel === '12:45:00') {
          console.log(`   🎯 CURRENT TIME: ${timeLabel} - ${isEndingSoon ? 'Should receive "ending soon" notification' : 'No notification expected'}`);
        }
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 4. Check what the check_break_reminders function actually sends
    console.log('\n4️⃣ Testing check_break_reminders for ending soon:');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      console.log(`   ✅ Function executed successfully - Notifications sent: ${notificationsSent}`);
      
      if (notificationsSent > 0) {
        // Check what notifications were created
        const newNotificationsResult = await pool.query(`
          SELECT 
            id,
            user_id,
            category,
            type,
            title,
            message,
            created_at
          FROM notifications
          WHERE category = 'break'
          AND created_at > NOW() - INTERVAL '5 minutes'
          ORDER BY created_at DESC
        `);
        
        console.log(`   📢 Found ${newNotificationsResult.rows.length} new notifications:`);
        newNotificationsResult.rows.forEach((notification, index) => {
          console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
          console.log(`      Type: ${notification.type}, Message: ${notification.message}`);
        });
      } else {
        console.log('   ℹ️ No notifications sent');
      }
      
    } catch (error) {
      console.log(`   ❌ Function failed: ${error.message}`);
    }
    
    // 5. Summary and answer to user's question
    console.log('\n✅ Ending soon timing check completed!');
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}:00`;
    
    console.log(`\n🎯 Answer to your question:`);
    console.log(`   Current time: ${currentTimeStr}`);
    console.log(`   Lunch break ends at: 13:00:00 (1:00 PM)`);
    
    // Calculate minutes until break ends
    const minutesUntilEnd = getMinutesUntilEnd(currentTimeStr, '13:00:00');
    
    if (minutesUntilEnd <= 15 && minutesUntilEnd > 0) {
      console.log(`   🎉 YES! You should receive "Break ending soon" notification at ${currentTimeStr}`);
      console.log(`   You are ${minutesUntilEnd} minutes before the break window ends`);
    } else if (minutesUntilEnd <= 0) {
      console.log(`   ❌ No, lunch break window has already ended`);
    } else {
      console.log(`   ❌ No, you are ${minutesUntilEnd} minutes before the break window ends`);
      console.log(`   "Ending soon" notifications typically trigger 15 minutes before`);
    }
    
  } catch (error) {
    console.error('❌ Error checking ending soon timing:', error);
  } finally {
    await pool.end();
  }
}

// Helper function to calculate minutes before end
function getMinutesBeforeEnd(testTime, endTime) {
  const test = new Date(`2025-08-19 ${testTime}`);
  const end = new Date(`2025-08-19 ${endTime}`);
  return Math.round((end - test) / (1000 * 60));
}

// Helper function to calculate minutes until end from current time
function getMinutesUntilEnd(currentTime, endTime) {
  const current = new Date(`2025-08-19 ${currentTime}`);
  const end = new Date(`2025-08-19 ${endTime}`);
  return Math.round((end - current) / (1000 * 60));
}

// Run the check
checkEndingSoonTiming();
