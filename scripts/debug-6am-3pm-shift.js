const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debug6am3pmShift() {
  try {
    console.log('🔍 Debugging 6AM-3PM Shift Issues...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check current shift time in database
    console.log('1️⃣ Current shift time in database:');
    const shiftResult = await pool.query(`
      SELECT ji.shift_time 
      FROM job_info ji 
      WHERE ji.agent_user_id = $1 OR ji.internal_user_id = $1
    `, [testAgentId]);
    
    if (shiftResult.rows.length > 0) {
      console.log(`   Shift: ${shiftResult.rows[0].shift_time}`);
    }
    
    // 2. Check calculated break windows
    console.log('\n2️⃣ Calculated break windows:');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) ORDER BY start_time
    `, [testAgentId]);
    
    breakWindowsResult.rows.forEach(window => {
      const startTime = window.start_time;
      const endTime = window.end_time;
      
      // Convert to 12-hour format
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      let startAmPm = startHour >= 12 ? 'PM' : 'AM';
      let endAmPm = endHour >= 12 ? 'PM' : 'AM';
      
      let displayStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
      let displayEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
      
      console.log(`   ${window.break_type}: ${displayStartHour}:${startTime.split(':')[1]} ${startAmPm} - ${displayEndHour}:${endTime.split(':')[1]} ${endAmPm}`);
    });
    
    // 3. Test why "Available Now" is triggering at 2:30 PM instead of 1:45 PM
    console.log('\n3️⃣ Testing "Available Now" at 2:30 PM:');
    const test230pm = '2025-08-20 14:30:00'; // 2:30 PM
    
    const availableNowResult = await pool.query(`
      SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as available_now
    `, [testAgentId, test230pm]);
    
    console.log(`   is_break_available_now at 2:30 PM: ${availableNowResult.rows[0].available_now ? '✅ TRUE' : '❌ FALSE'}`);
    console.log('   Expected: ❌ FALSE (should only be TRUE during 1:45 PM - 2:45 PM)');
    
    // Test at the correct time (1:45 PM)
    const test145pm = '2025-08-20 13:45:00'; // 1:45 PM
    
    const availableNowResult145 = await pool.query(`
      SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as available_now
    `, [testAgentId, test145pm]);
    
    console.log(`   is_break_available_now at 1:45 PM: ${availableNowResult145.rows[0].available_now ? '✅ TRUE' : '❌ FALSE'}`);
    console.log('   Expected: ✅ TRUE (should be TRUE during 1:45 PM - 2:45 PM)');
    
    // 4. Check recent notifications to see the spam
    console.log('\n4️⃣ Recent notifications (last 10 minutes):');
    const recentNotificationsResult = await pool.query(`
      SELECT 
        id,
        type,
        title,
        message,
        created_at
      FROM notifications 
      WHERE user_id = $1 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT 10
    `, [testAgentId]);
    
    if (recentNotificationsResult.rows.length > 0) {
      console.log(`   Found ${recentNotificationsResult.rows.length} recent notifications:`);
      recentNotificationsResult.rows.forEach((notification, index) => {
        const timeStr = notification.created_at.toLocaleTimeString('en-US', { 
          hour12: false, 
          timeZone: 'Asia/Manila' 
        });
        console.log(`   ${index + 1}. [${timeStr}] ${notification.title}`);
      });
    } else {
      console.log('   No recent notifications found');
    }
    
    console.log('\n🔧 Issues to fix:');
    console.log('   1. Afternoon break timing is wrong (showing 2:30 PM instead of 1:45 PM)');
    console.log('   2. Notification spam - need better duplicate prevention');
    console.log('   3. Check if break_available_now function is using wrong break window');
    
  } catch (error) {
    console.error('❌ Error debugging 6AM-3PM shift:', error.message);
  } finally {
    await pool.end();
  }
}

debug6am3pmShift();
