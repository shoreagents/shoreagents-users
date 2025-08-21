const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixActivityTimerNotCounting() {
  try {
    console.log('🔧 Fixing Activity Timer Not Counting Issue\n');
    
    // Test user 4 (night shift 10:00 PM - 7:00 AM)
    const userId = 4;
    
    console.log('1️⃣ Current situation:');
    const timeResult = await pool.query('SELECT NOW() + INTERVAL \'8 hours\' as manila_time');
    const manilaTime = timeResult.rows[0].manila_time;
    console.log('   • Current Manila time:', manilaTime);
    console.log('   • Shift: 10:00 PM - 7:00 AM');
    console.log('   • Shift should still be active (ends at 7:00 AM)');
    
    console.log('\n2️⃣ Current activity status:');
    const currentStatus = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
      LIMIT 1
    `, [userId]);
    
    if (currentStatus.rows.length > 0) {
      const status = currentStatus.rows[0];
      console.log('   • Current record:');
      console.log(`     - Date: ${status.today_date}`);
      console.log(`     - Active: ${status.today_active_seconds}s, Inactive: ${status.today_inactive_seconds}s`);
      console.log(`     - Currently Active: ${status.is_currently_active}`);
      console.log(`     - Last Update: ${status.updated_at}`);
      console.log(`     - Last Session Start: ${status.last_session_start}`);
    }
    
    console.log('\n3️⃣ Fixing the issue:');
    console.log('   • Setting user as ACTIVE to resume timer counting');
    console.log('   • This should start the activity timer again');
    
    // Update the user to be active
    const updateResult = await pool.query(`
      UPDATE activity_data 
      SET is_currently_active = TRUE, 
          updated_at = NOW(),
          last_session_start = CASE 
            WHEN last_session_start IS NULL THEN NOW()
            ELSE last_session_start
          END
      WHERE user_id = $1 AND today_date = $2
      RETURNING *
    `, [userId, currentStatus.rows[0].today_date]);
    
    if (updateResult.rows.length > 0) {
      console.log('   ✅ Successfully updated user to ACTIVE');
      console.log('   • New status:', updateResult.rows[0]);
    }
    
    console.log('\n4️⃣ Testing activity update:');
    // Simulate an activity update
    const testUpdate = await pool.query(`
      UPDATE activity_data 
      SET updated_at = NOW()
      WHERE user_id = $1 AND today_date = $2
      RETURNING *
    `, [userId, currentStatus.rows[0].today_date]);
    
    console.log('   • Test update completed');
    console.log('   • New updated_at:', testUpdate.rows[0].updated_at);
    
    console.log('\n5️⃣ Verifying the fix:');
    const verifyStatus = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, 
             is_currently_active, last_session_start, updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY today_date DESC, updated_at DESC
      LIMIT 1
    `, [userId]);
    
    if (verifyStatus.rows.length > 0) {
      const status = verifyStatus.rows[0];
      console.log('   • Verified status:');
      console.log(`     - Date: ${status.today_date}`);
      console.log(`     - Active: ${status.today_active_seconds}s, Inactive: ${status.today_inactive_seconds}s`);
      console.log(`     - Currently Active: ${status.is_currently_active}`);
      console.log(`     - Updated: ${status.updated_at}`);
      console.log(`     - Session Start: ${status.last_session_start}`);
      
      if (status.is_currently_active) {
        console.log('   ✅ User is now ACTIVE - timer should be counting!');
      } else {
        console.log('   ❌ User is still INACTIVE - something went wrong');
      }
    }
    
    console.log('\n6️⃣ Next steps for frontend:');
    console.log('   • Frontend should now send regular activity updates');
    console.log('   • Updates should be sent every few seconds/minutes');
    console.log('   • Each update will increment the active time');
    console.log('   • Timer should continue counting until 7:00 AM');
    
    console.log('\n7️⃣ Testing the API endpoint:');
    console.log('   • Try calling POST /api/activity with isCurrentlyActive: true');
    console.log('   • This should update the activity and keep the timer running');
    
  } catch (error) {
    console.error('❌ Error fixing activity timer:', error.message);
  } finally {
    await pool.end();
  }
}

fixActivityTimerNotCounting();

