const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugShiftValidation() {
  console.log('🔍 Debugging Shift Validation Logic\n');
  
  try {
    // 1. Check current time and agent shift info
    console.log('1️⃣ Current Time and Agent Shift Info:');
    
    const timeInfo = await pool.query(`
      SELECT 
        NOW() AT TIME ZONE 'Asia/Manila' as manila_now,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_hour,
        EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_minute,
        (NOW() AT TIME ZONE 'Asia/Manila')::TIME as manila_time_only
    `);
    
    const currentTime = timeInfo.rows[0];
    console.log(`   • Current Manila time: ${currentTime.manila_now}`);
    console.log(`   • Current hour: ${currentTime.manila_hour}`);
    console.log(`   • Current time only: ${currentTime.manila_time_only}`);
    
    // 2. Get agent shift information
    console.log('\n2️⃣ Agent Shift Information:');
    
    const shiftInfo = await pool.query(`
      SELECT * FROM get_agent_shift_info(2) LIMIT 1
    `);
    
    if (shiftInfo.rows.length > 0) {
      const shift = shiftInfo.rows[0];
      console.log(`   • User 2 shift_time: "${shift.shift_time}"`);
      console.log(`   • User 2 shift_period: "${shift.shift_period || 'Not set'}"`);
    } else {
      console.log('   ❌ No shift info found for User 2');
      return;
    }
    
    // 3. Test shift time parsing manually
    console.log('\n3️⃣ Manual Shift Time Parsing:');
    
    const shiftTime = shiftInfo.rows[0].shift_time;
    const shiftParts = shiftTime.split(' - ');
    const startPart = shiftParts[0].trim();
    const endPart = shiftParts[1].trim();
    
    console.log(`   • Start part: "${startPart}"`);
    console.log(`   • End part: "${endPart}"`);
    
    // Test PostgreSQL parsing
    const parseTest = await pool.query(`
      SELECT 
        split_part($1, ' - ', 1) as start_part,
        split_part($1, ' - ', 2) as end_part,
        CASE 
          WHEN split_part($1, ' - ', 1) LIKE '%PM' AND 
               NOT split_part($1, ' - ', 1) LIKE '12:%PM' THEN
              (split_part(split_part($1, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
          WHEN split_part($1, ' - ', 1) LIKE '12:%AM' THEN
              replace(split_part($1, ' - ', 1), '12:', '00:')::TIME
          ELSE
              split_part(split_part($1, ' - ', 1), ' ', 1)::TIME
        END as parsed_start_time,
        CASE 
          WHEN split_part($1, ' - ', 2) LIKE '%PM' AND 
               NOT split_part($1, ' - ', 2) LIKE '12:%PM' THEN
              (split_part(split_part($1, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
          WHEN split_part($1, ' - ', 2) LIKE '12:%AM' THEN
              replace(split_part($1, ' - ', 2), '12:', '00:')::TIME
          ELSE
              split_part(split_part($1, ' - ', 2), ' ', 1)::TIME
        END as parsed_end_time
    `, [shiftTime]);
    
    const parsed = parseTest.rows[0];
    console.log(`   • Parsed start time: ${parsed.parsed_start_time}`);
    console.log(`   • Parsed end time: ${parsed.parsed_end_time}`);
    
    const isNightShift = parsed.parsed_start_time > parsed.parsed_end_time;
    console.log(`   • Is night shift: ${isNightShift}`);
    
    // 4. Test the validation logic step by step
    console.log('\n4️⃣ Step-by-Step Validation Logic:');
    
    const currentTimeOnly = currentTime.manila_time_only;
    const shiftStart = parsed.parsed_start_time;
    const shiftEnd = parsed.parsed_end_time;
    
    console.log(`   • Current time: ${currentTimeOnly}`);
    console.log(`   • Shift start: ${shiftStart}`);
    console.log(`   • Shift end: ${shiftEnd}`);
    
    if (isNightShift) {
      console.log('   • Night shift validation:');
      const outsideShiftHours = currentTimeOnly < shiftStart && currentTimeOnly > shiftEnd;
      console.log(`     - Current time < shift start: ${currentTimeOnly < shiftStart}`);
      console.log(`     - Current time > shift end: ${currentTimeOnly > shiftEnd}`);
      console.log(`     - Outside shift hours: ${outsideShiftHours}`);
    } else {
      console.log('   • Day shift validation:');
      const outsideShiftHours = currentTimeOnly < shiftStart || currentTimeOnly > shiftEnd;
      console.log(`     - Current time < shift start: ${currentTimeOnly < shiftStart}`);
      console.log(`     - Current time > shift end: ${currentTimeOnly > shiftEnd}`);
      console.log(`     - Outside shift hours: ${outsideShiftHours}`);
    }
    
    // 5. Test break window calculations
    console.log('\n5️⃣ Break Window Calculations:');
    
    const breakStartQuery = await pool.query(`
      SELECT 
        $1::TIME + INTERVAL '4 hours' as lunch_break_start,
        $1::TIME + INTERVAL '7 hours' as lunch_break_end
    `, [shiftStart]);
    
    const lunchTimes = breakStartQuery.rows[0];
    console.log(`   • Lunch break start: ${lunchTimes.lunch_break_start}`);
    console.log(`   • Lunch break end: ${lunchTimes.lunch_break_end}`);
    console.log(`   • Current time in break window: ${currentTimeOnly >= lunchTimes.lunch_break_start && currentTimeOnly <= lunchTimes.lunch_break_end}`);
    
    // 6. Test the actual function with debugging
    console.log('\n6️⃣ Testing Actual Function:');
    
    const functionTest = await pool.query(`SELECT is_break_available_now(2, 'Lunch'::break_type_enum)`);
    console.log(`   • Function result: ${functionTest.rows[0].is_break_available_now}`);
    
    // 7. Create a test function with debugging output
    console.log('\n7️⃣ Creating Debug Version of Function:');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION debug_is_break_available_now(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
      )
      RETURNS TABLE(
          result BOOLEAN,
          debug_info TEXT,
          shift_time TEXT,
          current_time_only TIME,
          shift_start_time TIME,
          shift_end_time TIME,
          is_night_shift BOOLEAN,
          within_shift_hours BOOLEAN,
          break_start_time TIME,
          break_end_time TIME,
          within_break_window BOOLEAN
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          v_current_time_only TIME;
          v_break_start_time TIME;
          v_break_end_time TIME;
          v_shift_start_time TIME;
          v_shift_end_time TIME;
          v_is_night_shift BOOLEAN;
          v_within_shift_hours BOOLEAN;
          v_within_break_window BOOLEAN;
          v_result BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN QUERY SELECT FALSE, 'No shift configured', NULL::TEXT, NULL::TIME, NULL::TIME, NULL::TIME, NULL::BOOLEAN, NULL::BOOLEAN, NULL::TIME, NULL::TIME, NULL::BOOLEAN;
              RETURN;
          END IF;
          
          -- Parse shift time
          v_shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          v_shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift
          v_is_night_shift := v_shift_start_time > v_shift_end_time;
          
          -- Get current Manila time
          current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
          v_current_time_only := current_time_manila::TIME;
          
          -- Check if current time is within the agent's shift window
          IF v_is_night_shift THEN
              -- Night shift: current time should be after start OR before end
              v_within_shift_hours := NOT (v_current_time_only < v_shift_start_time AND v_current_time_only > v_shift_end_time);
          ELSE
              -- Day shift: current time should be between start and end
              v_within_shift_hours := v_current_time_only >= v_shift_start_time AND v_current_time_only <= v_shift_end_time;
          END IF;
          
          -- Calculate break times
          v_break_start_time := v_shift_start_time + INTERVAL '4 hours';
          v_break_end_time := v_shift_start_time + INTERVAL '7 hours';
          
          -- Check if within break window
          v_within_break_window := v_current_time_only >= v_break_start_time AND v_current_time_only <= v_break_end_time;
          
          -- Final result
          v_result := v_within_shift_hours AND v_within_break_window;
          
          RETURN QUERY SELECT 
              v_result,
              'Debug complete',
              shift_info.shift_time,
              v_current_time_only,
              v_shift_start_time,
              v_shift_end_time,
              v_is_night_shift,
              v_within_shift_hours,
              v_break_start_time,
              v_break_end_time,
              v_within_break_window;
      END;
      $$;
    `);
    
    // 8. Test the debug function
    console.log('\n8️⃣ Debug Function Results:');
    
    const debugResult = await pool.query(`SELECT * FROM debug_is_break_available_now(2, 'Lunch'::break_type_enum)`);
    const debug = debugResult.rows[0];
    
    console.log(`   • Final result: ${debug.result}`);
    console.log(`   • Shift time: ${debug.shift_time}`);
    console.log(`   • Current time only: ${debug.current_time_only}`);
    console.log(`   • Shift start time: ${debug.shift_start_time}`);
    console.log(`   • Shift end time: ${debug.shift_end_time}`);
    console.log(`   • Is night shift: ${debug.is_night_shift}`);
    console.log(`   • Within shift hours: ${debug.within_shift_hours}`);
    console.log(`   • Break start time: ${debug.break_start_time}`);
    console.log(`   • Break end time: ${debug.break_end_time}`);
    console.log(`   • Within break window: ${debug.within_break_window}`);
    
    // 9. Conclusion
    console.log('\n🎯 DIAGNOSIS:');
    if (!debug.within_shift_hours) {
      console.log('   ❌ ISSUE FOUND: Current time is OUTSIDE shift hours');
      console.log('   🔧 The function should return FALSE but is returning TRUE');
      console.log('   📝 This indicates the shift validation logic is not working correctly');
    } else if (!debug.within_break_window) {
      console.log('   ❌ ISSUE FOUND: Current time is OUTSIDE break window');
      console.log('   🔧 The function should return FALSE but is returning TRUE');
      console.log('   📝 This indicates the break window logic is not working correctly');
    } else {
      console.log('   ✅ Logic appears correct - break should be available');
    }
    
  } catch (error) {
    console.error('❌ Error debugging shift validation:', error.message);
  } finally {
    await pool.end();
  }
}

debugShiftValidation();
