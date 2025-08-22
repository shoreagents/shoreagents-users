const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugBreakReminderLogic() {
  console.log('🔍 Debugging break reminder logic step by step...\n');
  
  try {
    const userId = 2;
    const breakType = 'Lunch';
    const testTime = '2025-08-22 10:30:00';
    
    console.log(`Testing for User ID: ${userId}, Break Type: ${breakType}, Time: ${testTime}\n`);
    
    // 1. Check agent shift information
    console.log('1️⃣ Checking agent shift information...');
    const shiftResult = await pool.query('SELECT shift_time FROM job_info WHERE agent_user_id = $1 LIMIT 1', [userId]);
    const shiftTime = shiftResult.rows[0]?.shift_time;
    console.log(`   Shift time: ${shiftTime || 'Not found'}`);
    
    if (!shiftTime) {
      console.log('   ❌ No shift time found - function would return FALSE');
      return;
    }
    
    // 2. Check if break was already taken today
    console.log('\n2️⃣ Checking if break was already taken today...');
    const breakTakenResult = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM break_sessions
        WHERE agent_user_id = $1
        AND break_type = $2
        AND break_date = CURRENT_DATE
        AND end_time IS NOT NULL
      ) as break_taken
    `, [userId, breakType]);
    
    const breakAlreadyTaken = breakTakenResult.rows[0].break_taken;
    console.log(`   Break already taken: ${breakAlreadyTaken}`);
    
    if (breakAlreadyTaken) {
      console.log('   ❌ Break already taken - function would return FALSE');
      return;
    }
    
    // 3. Check break windows
    console.log('\n3️⃣ Checking break windows...');
    const breakWindowsResult = await pool.query('SELECT * FROM calculate_break_windows($1) WHERE break_type = $2', [userId, breakType]);
    
    if (breakWindowsResult.rows.length === 0) {
      console.log('   ❌ No break windows found - function would return FALSE');
      return;
    }
    
    const breakWindow = breakWindowsResult.rows[0];
    console.log(`   Break window: ${breakWindow.break_type} - ${breakWindow.start_time} to ${breakWindow.end_time}`);
    
    // 4. Check if we're within the break window
    console.log('\n4️⃣ Checking if current time is within break window...');
    
    // Use SQL to extract time and do the comparison
    const timeCheckResult = await pool.query(`
      SELECT 
        $1::timestamp without time zone::time as current_time_only,
        $2::time as break_start_time,
        $3::time as break_end_time,
        ($1::timestamp without time zone::time >= $2::time AND $1::timestamp without time zone::time <= $3::time) as within_window
    `, [testTime, breakWindow.start_time, breakWindow.end_time]);
    
    const timeCheck = timeCheckResult.rows[0];
    console.log(`   Current time (time only): ${timeCheck.current_time_only}`);
    console.log(`   Break start time: ${timeCheck.break_start_time}`);
    console.log(`   Break end time: ${timeCheck.break_end_time}`);
    console.log(`   Within break window: ${timeCheck.within_window}`);
    
    if (!timeCheck.within_window) {
      console.log('   ❌ Not within break window - function would return FALSE');
      return;
    }
    
    // 5. Calculate minutes since break started
    console.log('\n5️⃣ Calculating minutes since break started...');
    const minutesResult = await pool.query(`
      SELECT EXTRACT(EPOCH FROM ($1::timestamp without time zone::time - $2::time)) / 60 as minutes_since_start
    `, [testTime, breakWindow.start_time]);
    
    const minutesSinceStart = Math.floor(minutesResult.rows[0].minutes_since_start);
    console.log(`   Minutes since break started: ${minutesSinceStart}`);
    
    if (minutesSinceStart < 30) {
      console.log('   ❌ Less than 30 minutes - function would return FALSE');
      return;
    }
    
    // 6. Check recent notifications
    console.log('\n6️⃣ Checking recent notifications...');
    const notificationResult = await pool.query(`
      SELECT MAX(created_at) as last_notification_time
      FROM notifications
      WHERE user_id = $1
      AND category = 'break'
      AND payload->>'reminder_type' = 'missed_break'
      AND payload->>'break_type' = $2
      AND created_at < $3
      AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE
    `, [userId, breakType, testTime]);
    
    const lastNotificationTime = notificationResult.rows[0].last_notification_time;
    console.log(`   Last notification time: ${lastNotificationTime || 'None'}`);
    
    if (lastNotificationTime) {
      const notificationMinutesResult = await pool.query(`
        SELECT EXTRACT(EPOCH FROM ($1::timestamp without time zone - $2)) / 60 as minutes_since_last
      `, [testTime, lastNotificationTime]);
      
      const minutesSinceLastNotification = Math.floor(notificationMinutesResult.rows[0].minutes_since_last);
      console.log(`   Minutes since last notification: ${minutesSinceLastNotification}`);
      
      if (minutesSinceLastNotification < 25) {
        console.log('   ❌ Less than 25 minutes since last notification - function would return FALSE');
        return;
      }
    }
    
    // 7. Check 30-minute interval logic
    console.log('\n7️⃣ Checking 30-minute interval logic...');
    const remainder = minutesSinceStart % 30;
    const atInterval = remainder <= 5 || remainder >= 25;
    console.log(`   Minutes since start: ${minutesSinceStart}`);
    console.log(`   Remainder when divided by 30: ${remainder}`);
    console.log(`   At 30-minute interval (with 5-min tolerance): ${atInterval}`);
    
    if (!atInterval) {
      console.log('   ❌ Not at 30-minute interval - function would return FALSE');
      return;
    }
    
    console.log('\n✅ All checks passed! Function should return TRUE');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugBreakReminderLogic()
    .then(() => {
      console.log('\n🔍 Debugging completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Debugging failed:', error.message);
      process.exit(1);
    });
}

module.exports = { debugBreakReminderLogic };
