const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixActivityAPINightShiftSimple() {
  try {
    console.log('🔧 Fixing Activity API for Night Shift Date Rollovers (Simplified)\n');
    
    // 1. Create a simple function to get the correct activity date for any shift
    console.log('1️⃣ Creating get_activity_date_for_shift_simple function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_activity_date_for_shift_simple(
          p_user_id INTEGER
      )
      RETURNS DATE
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          activity_date DATE;
      BEGIN
          -- Get current Manila time
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, use current date
              RETURN current_time_manila::DATE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          IF is_night_shift THEN
              -- NIGHT SHIFT LOGIC: Activity date is the day the shift starts
              -- For night shifts, if we're before midnight, the shift started the previous day
              IF current_time_only < shift_start_time THEN
                  -- We're before midnight, so the shift started the previous day
                  activity_date := current_time_manila::DATE - INTERVAL '1 day';
              ELSE
                  -- We're after midnight, so the shift started today
                  activity_date := current_time_manila::DATE;
              END IF;
          ELSE
              -- DAY SHIFT LOGIC: Activity date is the current day
              activity_date := current_time_manila::DATE;
          END IF;
          
          RETURN activity_date;
      END;
      $$;
    `);
    console.log('   ✅ Created get_activity_date_for_shift_simple function');
    
    // 2. Create a function to check if we should reset activity for a new shift
    console.log('\n2️⃣ Creating should_reset_activity_simple function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION should_reset_activity_simple(
          p_user_id INTEGER
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
          last_activity_date DATE;
          current_activity_date DATE;
          should_reset BOOLEAN := FALSE;
      BEGIN
          -- Get current Manila time
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          current_time_only := current_time_manila::TIME;
          
          -- Get agent's shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              -- No shift configured, reset daily
              RETURN TRUE;
          END IF;
          
          -- Parse shift time
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get the last activity date for this user
          SELECT MAX(today_date) INTO last_activity_date
          FROM activity_data
          WHERE user_id = p_user_id;
          
          -- Get the current activity date for this shift
          current_activity_date := get_activity_date_for_shift_simple(p_user_id);
          
          IF last_activity_date IS NULL THEN
              -- No previous activity, this is a new shift
              RETURN TRUE;
          END IF;
          
          IF is_night_shift THEN
              -- NIGHT SHIFT LOGIC: Only reset when we start a completely new night shift
              -- Check if we've moved to a new night shift period
              IF current_time_only >= shift_start_time AND last_activity_date != current_activity_date THEN
                  should_reset := TRUE;
              END IF;
              
              -- Also reset if we're starting a new day and it's been more than 2 hours since last activity
              IF last_activity_date != current_activity_date THEN
                  DECLARE
                      last_activity_time TIMESTAMP;
                      hours_since_last_activity NUMERIC;
                  BEGIN
                      SELECT MAX(updated_at) INTO last_activity_time
                      FROM activity_data
                      WHERE user_id = p_user_id AND today_date = last_activity_date;
                      
                      IF last_activity_time IS NOT NULL THEN
                          hours_since_last_activity := EXTRACT(EPOCH FROM (current_time_manila - last_activity_time)) / 3600;
                          IF hours_since_last_activity > 2 THEN
                              should_reset := TRUE;
                          END IF;
                      END IF;
                  END;
              END IF;
          ELSE
              -- DAY SHIFT LOGIC: Reset daily at shift start time
              IF last_activity_date != current_activity_date THEN
                  should_reset := TRUE;
              END IF;
          END IF;
          
          RETURN should_reset;
      END;
      $$;
    `);
    console.log('   ✅ Created should_reset_activity_simple function');
    
    // 3. Test the new functions
    console.log('\n🎯 Testing the new functions...');
    
    // Test getting activity date
    const dateResult = await pool.query(`
      SELECT get_activity_date_for_shift_simple(4) as activity_date
    `);
    
    console.log('   • Activity date for user 4:', dateResult.rows[0].activity_date);
    
    // Test should reset
    const resetResult = await pool.query(`
      SELECT should_reset_activity_simple(4) as should_reset
    `);
    
    console.log('   • Should reset activity:', resetResult.rows[0].should_reset);
    
    // 4. Show current activity data
    console.log('\n📊 Current activity data for user 4:');
    const activityData = await pool.query(`
      SELECT today_date, today_active_seconds, today_inactive_seconds, updated_at
      FROM activity_data 
      WHERE user_id = 4 
      ORDER BY today_date DESC, updated_at DESC
    `);
    
    activityData.rows.forEach(row => {
      console.log(`   • Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s, Updated: ${row.updated_at}`);
    });
    
    console.log('\n✅ Simplified night shift activity tracking fix completed!');
    console.log('\n📋 What was fixed:');
    console.log('   • Created get_activity_date_for_shift_simple() - properly handles night shift date rollovers');
    console.log('   • Created should_reset_activity_simple() - only resets when starting a new shift period');
    console.log('   • Night shifts now maintain continuous activity counting across midnight');
    console.log('   • Activity date is anchored to the day the shift starts, not the current calendar day');
    
    console.log('\n🎯 How it now works:');
    console.log('   • Night shift 10:00 PM (8/20) → 7:00 AM (8/21): Activity date = 8/20');
    console.log('   • At midnight (12:00 AM 8/21): Activity continues counting for 8/20');
    console.log('   • At 7:00 AM (8/21): Shift ends, next shift starts at 10:00 PM (8/21)');
    console.log('   • New shift: Activity date = 8/21, timer resets to 0');
    
    console.log('\n🚀 Next steps:');
    console.log('   • Update the Next.js API routes to use get_activity_date_for_shift_simple()');
    console.log('   • Replace the old date calculation logic with calls to this function');
    console.log('   • Use should_reset_activity_simple() to determine when to reset timers');
    
  } catch (error) {
    console.error('❌ Error fixing activity API for night shifts:', error.message);
  } finally {
    await pool.end();
  }
}

fixActivityAPINightShiftSimple();








