const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixIsBreakMissedFinal() {
  try {
    console.log('🔧 Fixing is_break_missed function (final) - correct timing logic...\n');
    
    // Drop and recreate the function with correct timing logic
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
        break_already_taken BOOLEAN;
        current_date_manila DATE;
      BEGIN
        -- FINAL FIX: Use direct +8 hours addition for Manila time
        IF p_current_time IS NULL THEN
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
        ELSE
          current_time_manila := p_current_time + INTERVAL '8 hours';
        END IF;
        
        current_time_only := current_time_manila::TIME;
        current_date_manila := current_time_manila::DATE;
        
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
          AND break_date = current_date_manila
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
        
        -- CRITICAL FIX: Handle day rollover for night shifts
        -- For night shifts, if break time is earlier than shift start, it means it's the next day
        IF is_night_shift AND break_start_time < shift_start_time THEN
          -- This break happens the next day, so we need to check if we're in the right date
          -- For night shifts, the "current date" for break checking should be the previous day
          -- if we're before midnight, or the current day if we're after midnight
          
          IF current_time_only < shift_start_time THEN
            -- We're before midnight, so break date should be previous day
            -- But we're checking for today, so this break hasn't happened yet
            RETURN FALSE;
          ELSE
            -- We're after midnight, so break date should be current day
            -- This is correct, continue with normal logic
          END IF;
        END IF;
        
        -- Calculate minutes since break started
        minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
        
        -- Handle day rollover for night shifts in time calculations
        IF is_night_shift THEN
          -- If break start is earlier than shift start, it means it's the next day
          IF break_start_time < shift_start_time THEN
            -- Adjust current time to be relative to the break's day
            IF current_time_only < shift_start_time THEN
              -- We're before midnight, so break hasn't started yet
              RETURN FALSE;
            END IF;
          END IF;
        END IF;
        
        -- CRITICAL FIX: Break is only "missed" (needs reminder) if:
        -- 1. We're WITHIN the break window (not before, not after)
        -- 2. Break was not taken
        -- 3. We're within shift hours
        -- 4. It's been at least 30 minutes since break start
        -- 5. We're not too close to break end (within last 15 minutes)
        
        -- Check if we're within the break window
        IF current_time_only < break_start_time OR current_time_only >= break_end_time THEN
          RETURN FALSE; -- Outside break window
        END IF;
        
        -- Check if it's been at least 30 minutes since break start
        IF minutes_since_break_start < 30 THEN
          RETURN FALSE; -- Too early to send reminder
        END IF;
        
        -- Check if we're too close to break end (within last 15 minutes)
        DECLARE
          minutes_until_break_end INTEGER;
        BEGIN
          minutes_until_break_end := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
          IF minutes_until_break_end < 15 THEN
            RETURN FALSE; -- Too close to break end
          END IF;
        END;
        
        -- Send reminder every 30 minutes during the break window
        -- This ensures reminders at 12:30, 1:00, 1:30, etc. (every 30 minutes)
        RETURN (minutes_since_break_start % 30) = 0;
      END;
      $$;
    `);
    
    console.log('   ✅ Fixed is_break_missed function (final)');
    
    // Test the function with the correct timing expectations
    console.log('\n🧪 Testing the corrected function with proper timing...');
    
    // Test for User 4 (night shift) at various times
    const testResults = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '22 hours 45 minutes')::timestamp) as missed_at_1045pm,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '23 hours 45 minutes')::timestamp) as missed_at_1145pm,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours')::timestamp) as missed_at_12am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 30 minutes')::timestamp) as missed_at_1230am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 45 minutes')::timestamp) as missed_at_1245am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '1 hour')::timestamp) as missed_at_1am
    `);
    
    console.log(`   • 10:45 PM: ${testResults.rows[0].missed_at_1045pm} (should be FALSE - before break)`);
    console.log(`   • 11:45 PM: ${testResults.rows[0].missed_at_1145pm} (should be FALSE - before break)`);
    console.log(`   • 12:00 AM: ${testResults.rows[0].missed_at_12am} (should be FALSE - break just started)`);
    console.log(`   • 12:30 AM: ${testResults.rows[0].missed_at_1230am} (should be TRUE - 30 min reminder)`);
    console.log(`   • 12:45 AM: ${testResults.rows[0].missed_at_1245am} (should be FALSE - too close to end)`);
    console.log(`   • 1:00 AM: ${testResults.rows[0].missed_at_1am} (should be FALSE - break ended)`);
    
    console.log('\n🎯 Expected Behavior:');
    console.log('   • 11:45 PM: FALSE (break_available_soon will handle this)');
    console.log('   • 12:00 AM: FALSE (break_available_now will handle this)');
    console.log('   • 12:30 AM: TRUE (send "you have not taken your first night break")');
    console.log('   • 12:45 AM: FALSE (break_ending_soon will handle this)');
    console.log('   • 1:00 AM: FALSE (break window ended)');
    
    console.log('\n📋 Summary:');
    console.log('   • is_break_missed only sends reminders DURING the break window');
    console.log('   • Every 30 minutes after break starts (12:30, 1:00, 1:30, etc.)');
    console.log('   • Stops sending 15 minutes before break ends');
    console.log('   • Other functions handle: available soon, available now, ending soon');
    
  } catch (error) {
    console.error('❌ Error fixing function:', error.message);
  } finally {
    await pool.end();
  }
}

fixIsBreakMissedFinal();
