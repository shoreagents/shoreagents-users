const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Replicate socket server logic
async function testSocketShiftDetection() {
  try {
    console.log('🧪 Testing Socket Server Shift Detection Logic\n');
    
    const userId = 4; // Night shift user
    
    console.log('1️⃣ Getting shift information from database:');
    const shiftRes = await pool.query(
      `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
      [userId]
    );
    const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
    console.log('   • Raw shift_time from database:', shiftText);
    
    // Parse shift times (replicate socket server logic)
    const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    
    let shiftStartMinutes = null;
    let shiftEndMinutes = null;
    let hasShiftStart = false;
    let hasShiftEnd = false;
    
    if (both) {
      const start = both[1].trim().toUpperCase();
      const end = both[2].trim().toUpperCase();
      console.log('   • Parsed start time:', start);
      console.log('   • Parsed end time:', end);
      
      // Parse to 24h minutes (replicate socket server logic)
      const parseToMinutes = (token) => {
        const [hhmm, ampm] = token.split(/\s+/);
        const [hhStr, mmStr] = hhmm.split(':');
        let hh = parseInt(hhStr, 10);
        const mm = parseInt(mmStr, 10);
        if (ampm === 'AM') {
          if (hh === 12) hh = 0;
        } else if (ampm === 'PM') {
          if (hh !== 12) hh += 12;
        }
        return (hh * 60) + mm;
      };
      
      shiftStartMinutes = parseToMinutes(start);
      shiftEndMinutes = parseToMinutes(end);
      hasShiftStart = true;
      hasShiftEnd = true;
      
      console.log('   • Start minutes (24h):', shiftStartMinutes, `(${Math.floor(shiftStartMinutes/60)}:${String(shiftStartMinutes%60).padStart(2,'0')})`);
      console.log('   • End minutes (24h):', shiftEndMinutes, `(${Math.floor(shiftEndMinutes/60)}:${String(shiftEndMinutes%60).padStart(2,'0')})`);
    }
    
    console.log('\n2️⃣ Current Manila time:');
    const philippinesNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const currentHour = philippinesNow.getHours();
    const currentMinute = philippinesNow.getMinutes();
    const currentMinutesLocal = currentHour * 60 + currentMinute;
    
    console.log('   • Manila time:', philippinesNow);
    console.log('   • Current hour:', currentHour);
    console.log('   • Current minute:', currentMinute);
    console.log('   • Current minutes (24h):', currentMinutesLocal, `(${Math.floor(currentMinutesLocal/60)}:${String(currentMinutesLocal%60).padStart(2,'0')})`);
    
    console.log('\n3️⃣ Shift window detection:');
    let withinShift = true; // default allow if no shift configured
    
    if (hasShiftStart && hasShiftEnd && shiftStartMinutes !== null && shiftEndMinutes !== null) {
      console.log('   • Shift configuration found, checking window...');
      
      if (shiftEndMinutes > shiftStartMinutes) {
        // Day shift window [start, end)
        console.log('   • Day shift detected (end > start)');
        withinShift = currentMinutesLocal >= shiftStartMinutes && currentMinutesLocal < shiftEndMinutes;
        console.log(`   • Within shift check: ${currentMinutesLocal} >= ${shiftStartMinutes} && ${currentMinutesLocal} < ${shiftEndMinutes} = ${withinShift}`);
      } else {
        // Night shift crossing midnight: within if after start OR before end
        console.log('   • Night shift detected (end <= start)');
        const afterStart = currentMinutesLocal >= shiftStartMinutes;
        const beforeEnd = currentMinutesLocal < shiftEndMinutes;
        withinShift = afterStart || beforeEnd;
        console.log(`   • After start: ${currentMinutesLocal} >= ${shiftStartMinutes} = ${afterStart}`);
        console.log(`   • Before end: ${currentMinutesLocal} < ${shiftEndMinutes} = ${beforeEnd}`);
        console.log(`   • Within shift: ${afterStart} || ${beforeEnd} = ${withinShift}`);
      }
    } else {
      console.log('   • No shift configuration, defaulting to withinShift = true');
    }
    
    console.log('\n4️⃣ Activity date calculation:');
    const manilaYMD = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    
    const effective = new Date(philippinesNow);
    if (hasShiftStart && shiftStartMinutes !== null) {
      if (currentMinutesLocal < shiftStartMinutes) {
        effective.setDate(effective.getDate() - 1);
        console.log('   • Current time is before shift start, using previous day');
      } else {
        console.log('   • Current time is after shift start, using current day');
      }
    }
    const currentDate = manilaYMD(effective);
    console.log('   • Effective date:', currentDate);
    
    console.log('\n5️⃣ Database update decision:');
    if (withinShift) {
      console.log('   ✅ WITHIN SHIFT - Socket server WILL update database');
      console.log('   • Activity timer updates will be processed');
      console.log('   • Database writes will occur');
    } else {
      console.log('   ❌ OUTSIDE SHIFT - Socket server will NOT update database');
      console.log('   • Activity timer updates will be SKIPPED');
      console.log('   • No database writes will occur');
      console.log('   • This explains why the timer is not counting!');
    }
    
    console.log('\n6️⃣ Current activity data:');
    const activityData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
      LIMIT 2
    `, [userId]);
    
    console.log('   • Activity records:');
    activityData.rows.forEach((row, index) => {
      console.log(`     ${index + 1}. Date: ${row.today_date}`);
      console.log(`        Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
      console.log(`        Currently Active: ${row.is_currently_active}`);
      console.log(`        Updated: ${row.updated_at}`);
      console.log('');
    });
    
    console.log('\n📋 Summary:');
    console.log(`   • Current time: ${currentHour}:${String(currentMinute).padStart(2,'0')} Manila`);
    console.log(`   • Shift: ${shiftText}`);
    console.log(`   • Within shift window: ${withinShift}`);
    console.log(`   • Effective date: ${currentDate}`);
    
    if (withinShift) {
      console.log('   ✅ Socket server should be processing activity updates');
    } else {
      console.log('   ❌ Socket server is blocking activity updates - THIS IS THE PROBLEM!');
    }
    
  } catch (error) {
    console.error('❌ Error testing socket shift detection:', error.message);
  } finally {
    await pool.end();
  }
}

testSocketShiftDetection();

