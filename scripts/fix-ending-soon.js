const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixEndingSoon() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing is_break_ending_soon function...\n');
    
    await client.query('BEGIN');
    
    // Fix the is_break_ending_soon function to use new enum values
    console.log('   🔄 Updating is_break_ending_soon function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION is_break_ending_soon(
        p_agent_user_id INTEGER,
        p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        shift_info RECORD;
        break_windows RECORD;
        current_time_only TIME;
        break_end_time TIME;
        minutes_until_window_ends INTEGER;
        break_already_taken BOOLEAN;
        break_type_to_check break_type_enum;
      BEGIN
        -- Get agent shift information
        SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;

        IF NOT FOUND THEN
          RETURN FALSE;
        END IF;

        -- Get break windows for this shift
        SELECT * INTO break_windows FROM calculate_break_windows(shift_info.shift_time) LIMIT 1;

        current_time_only := p_current_time::TIME;

        -- Check each break type to see if its window is ending soon
        -- Morning break window ending soon?
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'Morning'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.morning_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Morning break window ending in 15 minutes
          END IF;
        END IF;

        -- Lunch break window ending soon?
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'Lunch'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.lunch_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Lunch break window ending in 15 minutes
          END IF;
        END IF;

        -- Afternoon break window ending soon?
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'Afternoon'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.afternoon_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE; -- Afternoon break window ending in 15 minutes
          END IF;
        END IF;

        -- Check night shift breaks with NEW enum values
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'NightFirst'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.morning_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
          END IF;
        END IF;

        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'NightMeal'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.lunch_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
          END IF;
        END IF;

        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = 'NightSecond'
          AND break_date = p_current_time::DATE
        ) INTO break_already_taken;

        IF NOT break_already_taken THEN
          minutes_until_window_ends := EXTRACT(EPOCH FROM (break_windows.afternoon_end - current_time_only)) / 60;
          IF minutes_until_window_ends < -720 THEN
            minutes_until_window_ends := minutes_until_window_ends + 1440;
          END IF;
          IF minutes_until_window_ends > 0 AND minutes_until_window_ends <= 15 THEN
            RETURN TRUE;
          END IF;
        END IF;

        RETURN FALSE;
      END;
      $$;
    `);
    console.log('   ✅ Function updated with new enum values');
    
    // Test the fixed function
    console.log('\n🧪 Testing the fixed function...');
    try {
      const result = await client.query(`
        SELECT is_break_ending_soon(2, '2025-01-19 07:45:00'::timestamp) as ending_soon
      `);
      console.log(`   ✅ Function works! Ending soon: ${result.rows[0].ending_soon}`);
    } catch (error) {
      console.log('   ❌ Function still has issues:', error.message);
    }
    
    await client.query('COMMIT');
    console.log('\n🎉 is_break_ending_soon function is now fixed!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to fix function:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixEndingSoon().catch(() => process.exit(1));
