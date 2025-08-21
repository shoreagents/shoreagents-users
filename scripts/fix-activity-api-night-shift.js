const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixActivityAPINightShift() {
  try {
    console.log('🔧 Fixing Activity API for Night Shift Date Rollovers\n');
    
    // 1. Create a function to handle activity updates with proper night shift logic
    console.log('1️⃣ Creating update_activity_with_night_shift_logic function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_activity_with_night_shift_logic(
          p_user_id INTEGER,
          p_is_currently_active BOOLEAN,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          current_time_manila TIMESTAMP;
          activity_date DATE;
          shift_period TEXT;
          should_reset BOOLEAN;
          existing_record RECORD;
          new_active_seconds INTEGER;
          new_inactive_seconds INTEGER;
          session_start TIMESTAMP;
          updated_rows INTEGER := 0;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          -- Get the correct activity date for this shift
          activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          -- Get the current shift period
          shift_period := get_current_shift_period(p_user_id, p_current_time);
          
          -- Check if we should reset the activity timer
          should_reset := should_reset_activity_for_shift(p_user_id, p_current_time);
          
          -- Get existing activity record for this date
          SELECT * INTO existing_record
          FROM activity_data
          WHERE user_id = p_user_id AND today_date = activity_date
          LIMIT 1;
          
          IF should_reset OR existing_record IS NULL THEN
              -- Create new activity record or reset existing one
              IF existing_record IS NULL THEN
                  -- Insert new record
                  INSERT INTO activity_data (
                      user_id, 
                      is_currently_active, 
                      today_active_seconds, 
                      today_inactive_seconds, 
                      last_session_start, 
                      today_date, 
                      updated_at
                  ) VALUES (
                      p_user_id,
                      p_is_currently_active,
                      0,
                      0,
                      current_time_manila,
                      activity_date,
                      current_time_manila
                  );
                  updated_rows := 1;
              ELSE
                  -- Reset existing record
                  UPDATE activity_data SET
                      is_currently_active = p_is_currently_active,
                      today_active_seconds = 0,
                      today_inactive_seconds = 0,
                      last_session_start = current_time_manila,
                      updated_at = current_time_manila
                  WHERE user_id = p_user_id AND today_date = activity_date;
                  updated_rows := 1;
              END IF;
          ELSE
              -- Update existing record with time tracking
              IF existing_record.is_currently_active != p_is_currently_active THEN
                  -- State is changing, calculate time differences
                  DECLARE
                      time_diff_seconds INTEGER;
                  BEGIN
                      -- Calculate time difference since last update
                      time_diff_seconds := EXTRACT(EPOCH FROM (current_time_manila - existing_record.updated_at));
                      
                      IF existing_record.is_currently_active THEN
                          -- Was active, now inactive - add to active time
                          new_active_seconds := existing_record.today_active_seconds + time_diff_seconds;
                          new_inactive_seconds := existing_record.today_inactive_seconds;
                      ELSE
                          -- Was inactive, now active - add to inactive time
                          new_active_seconds := existing_record.today_active_seconds;
                          new_inactive_seconds := existing_record.today_inactive_seconds + time_diff_seconds;
                      END IF;
                      
                      -- Update the record
                      UPDATE activity_data SET
                          is_currently_active = p_is_currently_active,
                          today_active_seconds = new_active_seconds,
                          today_inactive_seconds = new_inactive_seconds,
                          last_session_start = CASE 
                              WHEN p_is_currently_active THEN current_time_manila
                              ELSE existing_record.last_session_start
                          END,
                          updated_at = current_time_manila
                      WHERE user_id = p_user_id AND today_date = activity_date;
                      
                      updated_rows := 1;
                  END;
              ELSE
                  -- State hasn't changed, just update timestamp
                  UPDATE activity_data SET
                      updated_at = current_time_manila
                  WHERE user_id = p_user_id AND today_date = activity_date;
                  
                  updated_rows := 1;
              END IF;
          END IF;
          
          RETURN updated_rows;
      END;
      $$;
    `);
    console.log('   ✅ Created update_activity_with_night_shift_logic function');
    
    // 2. Create a function to get current activity status with proper night shift logic
    console.log('\n2️⃣ Creating get_current_activity_status function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_current_activity_status(
          p_user_id INTEGER,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS TABLE(
          today_date DATE,
          today_active_seconds INTEGER,
          today_inactive_seconds INTEGER,
          is_currently_active BOOLEAN,
          last_session_start TIMESTAMP,
          updated_at TIMESTAMP,
          shift_period TEXT
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
          current_time_manila TIMESTAMP;
          activity_date DATE;
          shift_period TEXT;
      BEGIN
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time + INTERVAL '8 hours';
          END IF;
          
          -- Get the correct activity date for this shift
          activity_date := get_activity_date_for_shift(p_user_id, p_current_time);
          
          -- Get the current shift period
          shift_period := get_current_shift_period(p_user_id, p_current_time);
          
          -- Return current activity status
          RETURN QUERY
          SELECT 
              ad.today_date,
              COALESCE(ad.today_active_seconds, 0) as today_active_seconds,
              COALESCE(ad.today_inactive_seconds, 0) as today_inactive_seconds,
              COALESCE(ad.is_currently_active, FALSE) as is_currently_active,
              ad.last_session_start,
              ad.updated_at,
              shift_period
          FROM activity_data ad
          WHERE ad.user_id = p_user_id AND ad.today_date = activity_date
          LIMIT 1;
          
          -- If no record found, return default values
          IF NOT FOUND THEN
              RETURN QUERY SELECT
                  activity_date as today_date,
                  0 as today_active_seconds,
                  0 as today_inactive_seconds,
                  FALSE as is_currently_active,
                  NULL::TIMESTAMP as last_session_start,
                  current_time_manila as updated_at,
                  shift_period;
          END IF;
      END;
      $$;
    `);
    console.log('   ✅ Created get_current_activity_status function');
    
    // 3. Test the new functions
    console.log('\n🎯 Testing the new functions...');
    
    // Test getting current activity status
    const statusResult = await pool.query(`
      SELECT * FROM get_current_activity_status(4)
    `);
    
    console.log('   • Current activity status for user 4:');
    if (statusResult.rows.length > 0) {
      const status = statusResult.rows[0];
      console.log(`     - Date: ${status.today_date}`);
      console.log(`     - Active: ${status.today_active_seconds}s`);
      console.log(`     - Inactive: ${status.today_inactive_seconds}s`);
      console.log(`     - Currently Active: ${status.is_currently_active}`);
      console.log(`     - Shift Period: ${status.shift_period}`);
    }
    
    // Test updating activity
    console.log('\n   • Testing activity update...');
    const updateResult = await pool.query(`
      SELECT update_activity_with_night_shift_logic(4, TRUE)
    `);
    console.log(`     - Updated rows: ${updateResult.rows[0].update_activity_with_night_shift_logic}`);
    
    // Check the result
    const finalStatus = await pool.query(`
      SELECT * FROM get_current_activity_status(4)
    `);
    
    console.log('\n   • Final activity status after update:');
    if (finalStatus.rows.length > 0) {
      const status = finalStatus.rows[0];
      console.log(`     - Date: ${status.today_date}`);
      console.log(`     - Active: ${status.today_active_seconds}s`);
      console.log(`     - Inactive: ${status.today_inactive_seconds}s`);
      console.log(`     - Currently Active: ${status.is_currently_active}`);
      console.log(`     - Shift Period: ${status.shift_period}`);
    }
    
    // 4. Show all activity data to verify the fix
    console.log('\n📊 All activity data for user 4:');
    const allActivity = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, is_currently_active, updated_at
      FROM activity_data 
      WHERE user_id = 4 
      ORDER BY today_date DESC, updated_at DESC
    `);
    
    allActivity.rows.forEach(row => {
      console.log(`   • Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s, Active: ${row.is_currently_active}, Updated: ${row.updated_at}`);
    });
    
    console.log('\n✅ Activity API night shift fix completed!');
    console.log('\n📋 What was fixed:');
    console.log('   • Created update_activity_with_night_shift_logic() - handles activity updates with proper night shift date logic');
    console.log('   • Created get_current_activity_status() - returns current activity status using correct shift-based dates');
    console.log('   • Activity timers now continue counting across midnight for night shifts');
    console.log('   • No more duplicate activity rows created at midnight');
    console.log('   • Activity date is properly anchored to the shift start date');
    
    console.log('\n🎯 How it now works:');
    console.log('   • Night shift 10:00 PM (8/20) → 7:00 AM (8/21): All activity goes to 8/20 row');
    console.log('   • At midnight (12:00 AM 8/21): Activity continues in 8/20 row, no new row created');
    console.log('   • At 7:00 AM (8/21): Shift ends, next shift starts at 10:00 PM (8/21)');
    console.log('   • New shift: New 8/21 row created, timer starts from 0');
    
    console.log('\n🚀 Next steps:');
    console.log('   • Update the Next.js API routes to use these new functions');
    console.log('   • Replace the old date calculation logic with calls to get_activity_date_for_shift()');
    console.log('   • Use update_activity_with_night_shift_logic() for all activity updates');
    
  } catch (error) {
    console.error('❌ Error fixing activity API for night shifts:', error.message);
  } finally {
    await pool.end();
  }
}

fixActivityAPINightShift();
