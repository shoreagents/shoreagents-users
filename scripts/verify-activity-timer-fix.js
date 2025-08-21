const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verifyActivityTimerFix() {
  try {
    console.log('🔍 Verifying Activity Timer Fix\n');
    
    const userId = 4; // Night shift user
    
    console.log('1️⃣ Current time status:');
    const timeResult = await pool.query('SELECT NOW() + INTERVAL \'8 hours\' as manila_time');
    const manilaTime = timeResult.rows[0].manila_time;
    console.log('   • Current Manila time:', manilaTime);
    console.log('   • Shift: 10:00 PM - 7:00 AM (ends in ~42 minutes)');
    
    console.log('\n2️⃣ API activity date calculation:');
    const apiDateResult = await pool.query(
      'SELECT get_activity_date_for_shift_simple($1) as activity_date',
      [userId]
    );
    const apiActivityDate = apiDateResult.rows[0].activity_date;
    const apiDateStr = apiActivityDate.toISOString().split('T')[0];
    console.log('   • API calculated date:', apiDateStr);
    
    console.log('\n3️⃣ Current activity records:');
    const activityData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
    `, [userId]);
    
    let activeRecord = null;
    let correctRecord = null;
    
    console.log('   • Activity records:');
    activityData.rows.forEach((row, index) => {
      const dateStr = row.today_date.toISOString().split('T')[0];
      const isApiTarget = dateStr === apiDateStr;
      const isActive = row.is_currently_active;
      
      console.log(`     ${index + 1}. Date: ${dateStr} ${isApiTarget ? '✅ (API target)' : ''} ${isActive ? '🟢 (ACTIVE)' : '🔴 (INACTIVE)'}`);
      console.log(`        Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
      console.log(`        Updated: ${row.updated_at}`);
      console.log('');
      
      if (isActive) activeRecord = row;
      if (isApiTarget) correctRecord = row;
    });
    
    console.log('\n4️⃣ Analysis:');
    
    if (activeRecord && correctRecord && activeRecord.today_date.getTime() === correctRecord.today_date.getTime()) {
      console.log('   ✅ PERFECT: Active record matches API target date');
      console.log('   ✅ API and socket server are synchronized');
      
      const timeSinceUpdate = Date.now() - new Date(activeRecord.updated_at).getTime();
      const minutesSinceUpdate = Math.floor(timeSinceUpdate / (1000 * 60));
      const secondsSinceUpdate = Math.floor((timeSinceUpdate % (1000 * 60)) / 1000);
      
      console.log(`   • Last update: ${minutesSinceUpdate}m ${secondsSinceUpdate}s ago`);
      
      if (timeSinceUpdate < 60000) { // Less than 1 minute
        console.log('   ✅ Recent activity - timer is counting!');
      } else if (timeSinceUpdate < 300000) { // Less than 5 minutes
        console.log('   ⚠️  Moderate delay - timer might be counting slowly');
      } else {
        console.log('   ❌ Long delay - timer might not be counting');
      }
      
    } else if (activeRecord && correctRecord) {
      console.log('   ⚠️  WARNING: Active record and API target are different dates');
      console.log(`   • Active record date: ${activeRecord.today_date.toISOString().split('T')[0]}`);
      console.log(`   • API target date: ${correctRecord.today_date.toISOString().split('T')[0]}`);
      console.log('   • This will cause timer sync issues');
      
    } else if (!activeRecord) {
      console.log('   ❌ ERROR: No active record found');
      console.log('   • User is not marked as active in any record');
      console.log('   • Timer will not count');
      
    } else if (!correctRecord) {
      console.log('   ❌ ERROR: No record found for API target date');
      console.log('   • API will not find the activity data');
      console.log('   • Frontend will show no activity');
    }
    
    console.log('\n5️⃣ Socket server compatibility check:');
    // Replicate socket server date calculation
    const shiftRes = await pool.query(
      `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
      [userId]
    );
    const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
    const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    
    let socketDateStr = 'unknown';
    if (both) {
      const start = both[1].trim().toUpperCase();
      const parseToMinutes = (token) => {
        const [hhmm, ampm] = token.split(/\s+/);
        const [hhStr, mmStr] = hhmm.split(':');
        let hh = parseInt(hhStr, 10);
        const mm = parseInt(mmStr, 10);
        if (ampm === 'AM') { if (hh === 12) hh = 0; } 
        else if (ampm === 'PM') { if (hh !== 12) hh += 12; }
        return (hh * 60) + mm;
      };
      
      const shiftStartMinutes = parseToMinutes(start);
      const philippinesNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const currentMinutesLocal = philippinesNow.getHours() * 60 + philippinesNow.getMinutes();
      
      const manilaYMD = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      
      const effective = new Date(philippinesNow);
      if (currentMinutesLocal < shiftStartMinutes) {
        effective.setDate(effective.getDate() - 1);
      }
      socketDateStr = manilaYMD(effective);
    }
    
    console.log(`   • Socket server target date: ${socketDateStr}`);
    console.log(`   • API target date: ${apiDateStr}`);
    
    if (socketDateStr === apiDateStr) {
      console.log('   ✅ Socket server and API dates match');
    } else {
      console.log('   ❌ Socket server and API dates MISMATCH');
      console.log('   • This will cause ongoing sync issues');
      console.log('   • Socket server updates will go to wrong record');
    }
    
    console.log('\n6️⃣ Recommendations:');
    
    if (activeRecord && correctRecord && activeRecord.today_date.getTime() === correctRecord.today_date.getTime() && socketDateStr === apiDateStr) {
      console.log('   🎉 EXCELLENT: Everything is synchronized!');
      console.log('   • Activity timer should be counting properly');
      console.log('   • No further action needed');
      
    } else {
      console.log('   🔧 Action required:');
      
      if (socketDateStr !== apiDateStr) {
        console.log('   1. Fix socket server date calculation to match API');
        console.log('   2. Update socket server to use get_activity_date_for_shift_simple()');
      }
      
      if (!activeRecord || (correctRecord && activeRecord.today_date.getTime() !== correctRecord.today_date.getTime())) {
        console.log('   3. Ensure correct record is set as active');
        console.log('   4. Deactivate incorrect records');
      }
      
      console.log('   5. Monitor activity updates to verify fix');
    }
    
  } catch (error) {
    console.error('❌ Error verifying activity timer fix:', error.message);
  } finally {
    await pool.end();
  }
}

verifyActivityTimerFix();

