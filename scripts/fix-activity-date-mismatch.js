const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixActivityDateMismatch() {
  try {
    console.log('🔧 Fixing Activity Date Mismatch Issue\n');
    
    const userId = 4; // Night shift user
    
    console.log('1️⃣ Current situation:');
    const timeResult = await pool.query('SELECT NOW() + INTERVAL \'8 hours\' as manila_time');
    const manilaTime = timeResult.rows[0].manila_time;
    console.log('   • Current Manila time:', manilaTime);
    console.log('   • Current shift: 10:00 PM - 7:00 AM (night shift)');
    console.log('   • Shift should be active until 7:00 AM');
    
    console.log('\n2️⃣ API function activity date calculation:');
    const apiDateResult = await pool.query(
      'SELECT get_activity_date_for_shift_simple($1) as activity_date',
      [userId]
    );
    const apiActivityDate = apiDateResult.rows[0].activity_date;
    console.log('   • API calculated date:', apiActivityDate);
    
    console.log('\n3️⃣ Socket server activity date calculation:');
    // Replicate socket server logic
    const shiftRes = await pool.query(
      `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
      [userId]
    );
    const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
    const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    
    let socketActivityDate = null;
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
      socketActivityDate = manilaYMD(effective);
    }
    console.log('   • Socket server calculated date:', socketActivityDate);
    
    console.log('\n4️⃣ Date comparison:');
    const apiDateStr = apiActivityDate.toISOString().split('T')[0];
    const socketDateStr = socketActivityDate;
    
    console.log('   • API date (YYYY-MM-DD):', apiDateStr);
    console.log('   • Socket date (YYYY-MM-DD):', socketDateStr);
    console.log('   • Dates match:', apiDateStr === socketDateStr);
    
    console.log('\n5️⃣ Current activity records:');
    const activityData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
    `, [userId]);
    
    console.log('   • All activity records:');
    activityData.rows.forEach((row, index) => {
      const dateStr = row.today_date.toISOString().split('T')[0];
      const isCorrectDate = dateStr === apiDateStr;
      const isSocketDate = dateStr === socketDateStr;
      console.log(`     ${index + 1}. Date: ${dateStr} ${isCorrectDate ? '✅ (API target)' : ''} ${isSocketDate ? '🔌 (Socket target)' : ''}`);
      console.log(`        Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
      console.log(`        Currently Active: ${row.is_currently_active}`);
      console.log(`        Updated: ${row.updated_at}`);
      console.log('');
    });
    
    console.log('\n6️⃣ Fixing the mismatch:');
    const correctDate = apiDateStr; // Use the API date as the correct one
    
    // Find the correct record
    const correctRecord = activityData.rows.find(row => 
      row.today_date.toISOString().split('T')[0] === correctDate
    );
    
    if (correctRecord) {
      console.log('   • Found correct record for date:', correctDate);
      console.log('   • Current values:', {
        active: correctRecord.today_active_seconds,
        inactive: correctRecord.today_inactive_seconds,
        isActive: correctRecord.is_currently_active
      });
      
      // Make sure this record is marked as active if needed
      if (!correctRecord.is_currently_active) {
        console.log('   • Setting correct record as ACTIVE...');
        await pool.query(`
          UPDATE activity_data 
          SET is_currently_active = TRUE,
              last_session_start = CASE 
                WHEN last_session_start IS NULL THEN NOW()
                ELSE last_session_start
              END,
              updated_at = NOW()
          WHERE user_id = $1 AND today_date = $2
        `, [userId, correctRecord.today_date]);
        console.log('   ✅ Correct record is now ACTIVE');
      } else {
        console.log('   ✅ Correct record is already ACTIVE');
      }
      
      // Clean up incorrect records (optional - be careful here)
      const incorrectRecords = activityData.rows.filter(row => 
        row.today_date.toISOString().split('T')[0] !== correctDate
      );
      
      if (incorrectRecords.length > 0) {
        console.log(`   • Found ${incorrectRecords.length} incorrect record(s)`);
        for (const record of incorrectRecords) {
          const recordDateStr = record.today_date.toISOString().split('T')[0];
          console.log(`   • Incorrect record date: ${recordDateStr}`);
          console.log(`     - Active: ${record.today_active_seconds}s, Inactive: ${record.today_inactive_seconds}s`);
          
          // Only deactivate if it has minimal activity
          if (record.today_active_seconds <= 10 && record.today_inactive_seconds <= 10) {
            console.log('     - Minimal activity, setting as INACTIVE');
            await pool.query(`
              UPDATE activity_data 
              SET is_currently_active = FALSE
              WHERE user_id = $1 AND today_date = $2
            `, [userId, record.today_date]);
          } else {
            console.log('     - Has significant activity, leaving as is');
          }
        }
      }
    } else {
      console.log('   ❌ No record found for correct date:', correctDate);
      console.log('   • Creating new record...');
      
      await pool.query(`
        INSERT INTO activity_data 
        (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, 
         last_session_start, today_date, updated_at)
        VALUES ($1, TRUE, 0, 0, NOW(), $2, NOW())
        ON CONFLICT (user_id, today_date) DO UPDATE SET
          is_currently_active = TRUE,
          last_session_start = COALESCE(activity_data.last_session_start, NOW()),
          updated_at = NOW()
      `, [userId, correctDate]);
      
      console.log('   ✅ Created new record for correct date');
    }
    
    console.log('\n7️⃣ Verification:');
    const verifyData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
    `, [userId]);
    
    console.log('   • Updated activity records:');
    verifyData.rows.forEach((row, index) => {
      const dateStr = row.today_date.toISOString().split('T')[0];
      const isCorrectDate = dateStr === correctDate;
      console.log(`     ${index + 1}. Date: ${dateStr} ${isCorrectDate ? '✅ (CORRECT)' : ''}`);
      console.log(`        Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
      console.log(`        Currently Active: ${row.is_currently_active}`);
      console.log(`        Updated: ${row.updated_at}`);
      console.log('');
    });
    
    console.log('\n✅ Activity date mismatch fix completed!');
    console.log('   • API and socket server should now be synchronized');
    console.log('   • Activity timer should start counting properly');
    
  } catch (error) {
    console.error('❌ Error fixing activity date mismatch:', error.message);
  } finally {
    await pool.end();
  }
}

fixActivityDateMismatch();








