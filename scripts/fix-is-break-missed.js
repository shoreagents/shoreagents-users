const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixIsBreakMissed() {
  try {
    console.log('🔧 Fixing is_break_missed function...\n');
    
    // Drop and recreate the function with correct logic
    const result = await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_missed(
        p_agent_user_id INTEGER,
        p_break_type break_type_enum,
        p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
        shift_info RECORD;
        current_time_manila TIMESTAMP;
        current_time_only TIME;
        shift_start_time TIME;
        shift_end_time TIME;
        is_night_shift BOOLEAN;
        break_start_time TIME;
        break_end_time TIME;
        minutes_since_break_start INTEGER;
        minutes_until_break_end INTEGER;
        break_already_taken BOOLEAN;
      BEGIN
        -- FINAL FIX: Use direct +8 hours addition for Manila time
        IF p_current_time IS NULL THEN
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
        ELSE
          current_time_manila := p_current_time + INTERVAL '8 hours';
        END IF;
        
        current_time_only := current_time_manila::TIME;
        
        -- Get agent's actual shift information
        SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
        
        IF NOT FOUND OR shift_info.shift_time IS NULL THEN
          RETURN FALSE; -- No shift configured
        END IF;
        
        -- Parse shift time (e.g., "7:00 AM - 4:00 PM" or "10:00 PM - 7:00 AM")
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
        
        -- Check if current time is within the agent's shift window
        IF is_night_shift THEN
          -- Night shift: current time should be after start OR before end
          IF current_time_only < shift_start_time AND current_time_only > shift_end_time THEN
            RETURN FALSE; -- Outside shift hours
          END IF;
        ELSE
          -- Day shift: current time should be between start and end
          IF current_time_only < shift_start_time OR current_time_only > shift_end_time THEN
            RETURN FALSE; -- Outside shift hours
          END IF;
        END IF;
        
        -- Check if break was already taken today
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND break_type = p_break_type
          AND break_date = current_time_manila::DATE
          AND end_time IS NOT NULL
        ) INTO break_already_taken;
        
        IF break_already_taken THEN
          RETURN FALSE; -- Break already taken
        END IF;
        
        -- Calculate break start and end times based on shift start
        CASE p_break_type
          WHEN 'Morning' THEN
            break_start_time := shift_start_time + INTERVAL '2 hours';
            break_end_time := shift_start_time + INTERVAL '3 hours';
          WHEN 'Lunch' THEN
            break_start_time := shift_start_time + INTERVAL '4 hours';
            break_end_time := shift_start_time + INTERVAL '7 hours';
          WHEN 'Afternoon' THEN
            break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
            break_end_time := shift_start_time + INTERVAL '8 hours 45 minutes';
          WHEN 'NightFirst' THEN
            break_start_time := shift_start_time + INTERVAL '2 hours';
            break_end_time := shift_start_time + INTERVAL '3 hours';
          WHEN 'NightMeal' THEN
            break_start_time := shift_start_time + INTERVAL '4 hours';
            break_end_time := shift_start_time + INTERVAL '7 hours';
          WHEN 'NightSecond' THEN
            break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
            break_end_time := shift_start_time + INTERVAL '8 hours 45 minutes';
          ELSE
            RETURN FALSE;
        END CASE;
        
        -- Handle day rollover for night shifts
        IF is_night_shift THEN
          IF break_start_time < shift_start_time THEN
            break_start_time := break_start_time + INTERVAL '24 hours';
            break_end_time := break_end_time + INTERVAL '24 hours';
          END IF;
        END IF;
        
        -- Calculate time relationships
        minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
        minutes_until_break_end := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
        
        -- Handle day rollover for night shifts in time calculations
        IF is_night_shift THEN
          IF minutes_since_break_start < -720 THEN
            minutes_since_break_start := minutes_since_break_start + 1440;
          END IF;
          IF minutes_until_break_end < -720 THEN
            minutes_until_break_end := minutes_until_break_end + 1440;
          END IF;
        END IF;
        
        -- CRITICAL FIX: Break is only missed if:
        -- 1. We're AFTER the break window has ended
        -- 2. Break was not taken
        -- 3. We're within shift hours
        
        IF minutes_until_break_end < 0 THEN
          -- Break window has ended, check if we should send missed notification
          -- Only send every 30 minutes to avoid spam
          RETURN (ABS(minutes_until_break_end) % 30) = 0;
        END IF;
        
        -- Break window is still active or hasn't started yet
        RETURN FALSE;
      END;
      $$;
    `);
    
    console.log('   ✅ Fixed is_break_missed function');
    
    // Test the function
    console.log('\n🧪 Testing the fixed function...');
    
    // Test for User 4 (night shift) at 10:00 PM
    const testUser4 = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '22 hours')::timestamp) as missed_at_10pm
    `);
    
    console.log(`   • User 4 NightFirst missed at 10:00 PM: ${testUser4.rows[0].missed_at_10pm}`);
    
    // Test for User 4 (night shift) at 1:00 AM (after break window)
    const testUser4AfterBreak = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '1 hour')::timestamp) as missed_at_1am
    `);
    
    console.log(`   • User 4 NightFirst missed at 1:00 AM: ${testUser4AfterBreak.rows[0].missed_at_1am}`);
    
    console.log('\n🎯 Expected Behavior:');
    console.log('   • At 10:00 PM: FALSE (break window hasn\'t started yet)');
    console.log('   • At 1:00 AM: TRUE (break window ended, break was missed)');
    
  } catch (error) {
    console.error('❌ Error fixing function:', error.message);
  } finally {
    await pool.end();
  }
}

fixIsBreakMissed();
