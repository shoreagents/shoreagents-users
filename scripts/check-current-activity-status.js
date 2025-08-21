const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentActivityStatus() {
  try {
    console.log('🔍 Checking Current Activity Status for Night Shift\n');
    
    // Test user 4 (night shift 10:00 PM - 7:00 AM)
    const userId = 4;
    
    console.log('1️⃣ Current time and shift status:');
    const timeResult = await pool.query('SELECT NOW() + INTERVAL \'8 hours\' as manila_time');
    const manilaTime = timeResult.rows[0].manila_time;
    console.log('   • Current Manila time:', manilaTime);
    
    // Get shift info
    const shiftResult = await pool.query(`
      SELECT ji.shift_time
      FROM job_info ji
      WHERE ji.agent_user_id = $1
      ORDER BY ji.id DESC
      LIMIT 1
    `, [userId]);
    
    if (shiftResult.rows.length > 0) {
      console.log('   • Shift time:', shiftResult.rows[0].shift_time);
    }
    
    console.log('\n2️⃣ Activity date calculation:');
    const dateResult = await pool.query(
      'SELECT get_activity_date_for_shift_simple($1) as activity_date',
      [userId]
    );
    console.log('   • Calculated activity date:', dateResult.rows[0].activity_date);
    
    console.log('\n3️⃣ Should reset activity:');
    const resetResult = await pool.query(
      'SELECT should_reset_activity_simple($1) as should_reset',
      [userId]
    );
    console.log('   • Should reset:', resetResult.rows[0].should_reset);
    
    console.log('\n4️⃣ Current activity data:');
    const activityData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
    `, [userId]);
    
    console.log('   • Activity records for user 4:');
    activityData.rows.forEach((row, index) => {
      console.log(`     ${index + 1}. Date: ${row.today_date}`);
      console.log(`        Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
      console.log(`        Currently Active: ${row.is_currently_active}`);
      console.log(`        Last Session Start: ${row.last_session_start}`);
      console.log(`        Updated: ${row.updated_at}`);
      console.log('');
    });
    
    console.log('\n5️⃣ Shift period identification:');
    const shiftPeriodResult = await pool.query(
      'SELECT get_current_shift_period($1) as shift_period',
      [userId]
    );
    console.log('   • Current shift period:', shiftPeriodResult.rows[0].shift_period);
    
    console.log('\n6️⃣ Time since last activity update:');
    if (activityData.rows.length > 0) {
      const lastUpdate = new Date(activityData.rows[0].updated_at);
      const now = new Date();
      const timeDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
      const minutesDiff = Math.floor(timeDiff / 60);
      const secondsDiff = timeDiff % 60;
      console.log(`   • Last update: ${lastUpdate}`);
      console.log(`   • Time since last update: ${minutesDiff}m ${secondsDiff}s`);
      
      if (timeDiff > 300) { // 5 minutes
        console.log('   ⚠️  WARNING: Last update was more than 5 minutes ago!');
      }
    }
    
    console.log('\n7️⃣ Testing activity update function:');
    try {
      const updateResult = await pool.query(
        'SELECT update_activity_with_night_shift_logic($1, TRUE) as updated_rows',
        [userId]
      );
      console.log('   • Activity update result:', updateResult.rows[0].updated_rows);
    } catch (error) {
      console.log('   • Activity update function not available:', error.message);
    }
    
    console.log('\n🔍 Analysis:');
    if (activityData.rows.length > 0) {
      const latest = activityData.rows[0];
      if (!latest.is_currently_active) {
        console.log('   • User is currently marked as INACTIVE');
        console.log('   • This means the timer is not counting');
        console.log('   • Need to set is_currently_active = TRUE to start counting');
      } else {
        console.log('   • User is currently marked as ACTIVE');
        console.log('   • Timer should be counting if frontend is sending updates');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking activity status:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentActivityStatus();
