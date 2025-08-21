const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verifyAllFunctionsTimestamp() {
  console.log('🔍 Verifying All Break Notification Functions Timestamp Logic\n');
  
  try {
    // 1. Check current time in different formats
    console.log('1️⃣ Current Time Analysis:');
    
    const timeAnalysis = await pool.query(`
      SELECT 
        NOW() as db_now,
        CURRENT_TIMESTAMP as current_timestamp,
        NOW() + INTERVAL '8 hours' as now_plus_8,
        CURRENT_TIMESTAMP + INTERVAL '8 hours' as current_plus_8,
        (NOW() + INTERVAL '8 hours')::TIME as time_only_plus_8,
        NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' as manila_utc_convert,
        (NOW() AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::TIME as manila_time_utc_convert,
        NOW() AT TIME ZONE 'Asia/Manila' as manila_direct,
        (NOW() AT TIME ZONE 'Asia/Manila')::TIME as manila_time_direct
    `);
    
    const time = timeAnalysis.rows[0];
    console.log(`   • Database NOW(): ${time.db_now}`);
    console.log(`   • CURRENT_TIMESTAMP: ${time.current_timestamp}`);
    console.log(`   • NOW() + 8 hours: ${time.now_plus_8}`);
    console.log(`   • CURRENT_TIMESTAMP + 8 hours: ${time.current_plus_8}`);
    console.log(`   • Time only + 8 hours: ${time.time_only_plus_8}`);
    console.log(`   • Manila UTC convert: ${time.manila_utc_convert}`);
    console.log(`   • Manila time UTC convert: ${time.manila_time_utc_convert}`);
    console.log(`   • Manila direct: ${time.manila_direct}`);
    console.log(`   • Manila time direct: ${time.manila_time_direct}`);
    
    // 2. List all break notification functions
    console.log('\n2️⃣ All Break Notification Functions:');
    
    const allFunctions = await pool.query(`
      SELECT 
        proname as function_name,
        oidvectortypes(proargtypes) as arguments,
        prosrc as source_code
      FROM pg_proc 
      WHERE proname IN (
        'is_break_available_now',
        'is_break_available_soon', 
        'is_break_missed',
        'is_break_ending_soon',
        'check_break_reminders',
        'create_break_reminder_notification',
        'calculate_break_windows',
        'get_agent_shift_info'
      )
      ORDER BY proname
    `);
    
    console.log(`   • Found ${allFunctions.rows.length} break notification functions:`);
    allFunctions.rows.forEach((func, index) => {
      console.log(`     ${index + 1}. ${func.function_name}(${func.arguments})`);
    });
    
    // 3. Check each function's timestamp logic
    console.log('\n3️⃣ Function-by-Function Timestamp Logic Analysis:');
    
    for (const func of allFunctions.rows) {
      console.log(`\n   🔍 ${func.function_name}:`);
      
      const sourceCode = func.source_code;
      
      // Check for timestamp-related patterns
      const timestampPatterns = [
        { pattern: 'CURRENT_TIMESTAMP', name: 'CURRENT_TIMESTAMP' },
        { pattern: 'NOW()', name: 'NOW()' },
        { pattern: 'AT TIME ZONE', name: 'Timezone conversion' },
        { pattern: '+ INTERVAL \'8 hours\'', name: 'Direct +8 hours' },
        { pattern: 'INTERVAL \'8 hours\'', name: '8 hours interval' },
        { pattern: 'Asia/Manila', name: 'Manila timezone' },
        { pattern: 'UTC', name: 'UTC timezone' }
      ];
      
      timestampPatterns.forEach(pattern => {
        if (sourceCode.includes(pattern.pattern)) {
          console.log(`     ✅ Uses: ${pattern.name}`);
        }
      });
      
      // Check for specific timestamp logic
      if (sourceCode.includes('CURRENT_TIMESTAMP + INTERVAL \'8 hours\'')) {
        console.log(`     ✅ CORRECT: Uses direct +8 hours approach`);
      } else if (sourceCode.includes('AT TIME ZONE \'UTC\' AT TIME ZONE \'Asia/Manila\'')) {
        console.log(`     ⚠️  WARNING: Uses complex timezone conversion`);
      } else if (sourceCode.includes('AT TIME ZONE \'Asia/Manila\'')) {
        console.log(`     ⚠️  WARNING: Uses direct Manila timezone (may be wrong)`);
      } else if (sourceCode.includes('CURRENT_TIMESTAMP') || sourceCode.includes('NOW()')) {
        console.log(`     ❌ ISSUE: Uses raw database timestamp (no Manila conversion)`);
      }
    }
    
    // 4. Test each function with timestamp verification
    console.log('\n4️⃣ Testing Each Function with Timestamp Verification:');
    
    // Test is_break_available_now
    console.log('\n   🔍 Testing is_break_available_now:');
    try {
      const test1 = await pool.query(`SELECT is_break_available_now(2, 'Lunch'::break_type_enum)`);
      console.log(`     • User 2 Lunch break: ${test1.rows[0].is_break_available_now}`);
      
      const test2 = await pool.query(`SELECT is_break_available_now(4, 'NightSecond'::break_type_enum)`);
      console.log(`     • User 4 NightSecond break: ${test2.rows[0].is_break_available_now}`);
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
    }
    
    // Test is_break_available_soon
    console.log('\n   🔍 Testing is_break_available_soon:');
    try {
      const test1 = await pool.query(`SELECT is_break_available_soon(2, 'Lunch'::break_type_enum)`);
      console.log(`     • User 2 Lunch break: ${test1.rows[0].is_break_available_soon}`);
      
      const test2 = await pool.query(`SELECT is_break_available_soon(4, 'NightSecond'::break_type_enum)`);
      console.log(`     • User 4 NightSecond break: ${test2.rows[0].is_break_available_soon}`);
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
    }
    
    // Test check_break_reminders
    console.log('\n   🔍 Testing check_break_reminders:');
    try {
      const test = await pool.query(`SELECT check_break_reminders()`);
      console.log(`     • Notifications sent: ${test.rows[0].check_break_reminders}`);
    } catch (error) {
      console.log(`     ❌ Error: ${error.message}`);
    }
    
    // 5. Create a timestamp verification function
    console.log('\n5️⃣ Creating Timestamp Verification Function:');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION verify_timestamp_logic(
          p_function_name TEXT DEFAULT NULL
      )
      RETURNS TABLE(
          function_name TEXT,
          timestamp_method TEXT,
          current_db_time TIMESTAMP,
          current_manila_time TIMESTAMP,
          current_manila_time_only TIME,
          shift_start_time TIME,
          shift_end_time TIME,
          is_within_shift BOOLEAN,
          break_start_time TIME,
          break_end_time TIME,
          is_within_break BOOLEAN
      )
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          shift_start_time TIME;
          shift_end_time TIME;
          break_start_time TIME;
          break_end_time TIME;
          is_night_shift BOOLEAN;
          within_shift BOOLEAN;
          within_break BOOLEAN;
      BEGIN
          -- Get agent shift info for User 2 (day shift)
          SELECT * INTO shift_info FROM get_agent_shift_info(2) LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN QUERY SELECT 'No shift info', 'N/A', NULL::TIMESTAMP, NULL::TIMESTAMP, NULL::TIME, NULL::TIME, NULL::TIME, NULL::BOOLEAN, NULL::TIME, NULL::TIME, NULL::BOOLEAN;
              RETURN;
          END IF;
          
          -- Test different timestamp methods
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          current_time_only := current_time_manila::TIME;
          
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
          
          -- Check if within shift hours
          within_shift := current_time_only >= shift_start_time AND current_time_only <= shift_end_time;
          
          -- Calculate lunch break times
          break_start_time := shift_start_time + INTERVAL '4 hours';
          break_end_time := shift_start_time + INTERVAL '7 hours';
          
          -- Check if within break window
          within_break := current_time_only >= break_start_time AND current_time_only <= break_end_time;
          
          RETURN QUERY SELECT 
              COALESCE(p_function_name, 'Timestamp Verification'),
              'CURRENT_TIMESTAMP + INTERVAL \'8 hours\'',
              CURRENT_TIMESTAMP,
              current_time_manila,
              current_time_only,
              shift_start_time,
              shift_end_time,
              within_shift,
              break_start_time,
              break_end_time,
              within_break;
      END;
      $$;
    `);
    
    console.log('   ✅ Created timestamp verification function');
    
    // 6. Test the verification function
    console.log('\n6️⃣ Timestamp Verification Results:');
    
    const verification = await pool.query(`SELECT * FROM verify_timestamp_logic()`);
    const verify = verification.rows[0];
    
    console.log(`   • Function: ${verify.function_name}`);
    console.log(`   • Timestamp method: ${verify.timestamp_method}`);
    console.log(`   • Current DB time: ${verify.current_db_time}`);
    console.log(`   • Current Manila time: ${verify.current_manila_time}`);
    console.log(`   • Current Manila time only: ${verify.current_manila_time_only}`);
    console.log(`   • Shift start: ${verify.shift_start_time}`);
    console.log(`   • Shift end: ${verify.shift_end_time}`);
    console.log(`   • Within shift hours: ${verify.is_within_shift}`);
    console.log(`   • Break start: ${verify.break_start_time}`);
    console.log(`   • Break end: ${verify.break_end_time}`);
    console.log(`   • Within break window: ${verify.is_within_break}`);
    
    // 7. Summary and recommendations
    console.log('\n🎯 TIMESTAMP LOGIC SUMMARY:');
    
    let correctFunctions = 0;
    let warningFunctions = 0;
    let issueFunctions = 0;
    
    allFunctions.rows.forEach(func => {
      const sourceCode = func.source_code;
      if (sourceCode.includes('CURRENT_TIMESTAMP + INTERVAL \'8 hours\'')) {
        correctFunctions++;
      } else if (sourceCode.includes('AT TIME ZONE')) {
        warningFunctions++;
      } else if (sourceCode.includes('CURRENT_TIMESTAMP') || sourceCode.includes('NOW()')) {
        issueFunctions++;
      }
    });
    
    console.log(`   ✅ Functions using correct +8 hours: ${correctFunctions}`);
    console.log(`   ⚠️  Functions using timezone conversion: ${warningFunctions}`);
    console.log(`   ❌ Functions with timestamp issues: ${issueFunctions}`);
    
    if (correctFunctions === allFunctions.rows.length) {
      console.log('\n🎉 ALL FUNCTIONS ARE USING CORRECT TIMESTAMP LOGIC!');
    } else {
      console.log('\n⚠️  SOME FUNCTIONS NEED TIMESTAMP FIXES');
      console.log('   • Functions using timezone conversion may have issues');
      console.log('   • Functions using raw timestamps will be wrong');
      console.log('   • Recommend updating all functions to use +8 hours approach');
    }
    
  } catch (error) {
    console.error('❌ Error verifying functions:', error.message);
  } finally {
    await pool.end();
  }
}

verifyAllFunctionsTimestamp();
