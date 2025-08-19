const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugLunchBreakLogic() {
  try {
    console.log('🔍 Debugging Lunch Break Logic...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check if lunch break was already taken today
    console.log('1️⃣ Checking if lunch break was already taken today:');
    const breakTakenResult = await pool.query(`
      SELECT 
        COUNT(*) as break_count,
        MAX(created_at) as last_break_time
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND break_type = 'Lunch' 
      AND DATE(created_at) = (NOW() AT TIME ZONE 'Asia/Manila')::DATE
    `, [testAgentId]);
    
    console.log('   Lunch breaks taken today:', breakTakenResult.rows[0].break_count);
    if (breakTakenResult.rows[0].break_count > 0) {
      console.log('   Last lunch break:', breakTakenResult.rows[0].last_break_time);
    }
    
    // 2. Check the exact logic of is_break_available function
    console.log('\n2️⃣ Checking is_break_available function logic:');
    
    // Get agent shift info
    const shiftInfoResult = await pool.query(`
      SELECT * FROM get_agent_shift_info($1)
    `, [testAgentId]);
    
    console.log('   Agent shift info:', shiftInfoResult.rows[0]);
    
    // Get break windows
    const windowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [shiftInfoResult.rows[0].shift_time]);
    
    console.log('   Break windows:', windowsResult.rows[0]);
    
    // 3. Test the function step by step with the exact same logic
    console.log('\n3️⃣ Testing function logic step by step:');
    
    const currentTimeResult = await pool.query(`
      SELECT 
        NOW() AT TIME ZONE 'Asia/Manila' as current_time,
        (NOW() AT TIME ZONE 'Asia/Manila')::time as current_time_only,
        $1::time as lunch_start,
        $2::time as lunch_end,
        $3::date as current_date
    `, [
      windowsResult.rows[0].lunch_start, 
      windowsResult.rows[0].lunch_end,
      '2025-08-19'
    ]);
    
    const currentTime = currentTimeResult.rows[0];
    console.log('   Current time info:', currentTime);
    
    // Manual calculation
    console.log('\n   Manual calculation:');
    console.log(`     Current time: ${currentTime.current_time_only}`);
    console.log(`     Lunch start: ${currentTime.lunch_start}`);
    console.log(`     Lunch end: ${currentTime.lunch_end}`);
    console.log(`     Current date: ${currentTime.current_date}`);
    
    const currentTimeOnly = currentTime.current_time_only;
    const lunchStart = currentTime.lunch_start;
    const lunchEnd = currentTime.lunch_end;
    
    console.log(`     Is current time >= lunch start? ${currentTimeOnly >= lunchStart}`);
    console.log(`     Is current time <= lunch end? ${currentTimeOnly <= lunchEnd}`);
    console.log(`     Should lunch be available? ${currentTimeOnly >= lunchStart && currentTimeOnly <= lunchEnd}`);
    
    // 4. Check if there are any other conditions in the function
    console.log('\n4️⃣ Checking for other conditions:');
    
    // Check if agent is currently on break
    const onBreakResult = await pool.query(`
      SELECT 
        COUNT(*) as active_breaks
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND break_type = 'Lunch'
      AND status = 'active'
      AND DATE(created_at) = (NOW() AT TIME ZONE 'Asia/Manila')::DATE
    `, [testAgentId]);
    
    console.log('   Active lunch breaks:', onBreakResult.rows[0].active_breaks);
    
    // Check if there are any other restrictions
    console.log('\n5️⃣ Testing with a time that should definitely work:');
    
    // Test with 11:00 AM (should be within lunch break window)
    const testTimeResult = await pool.query(`
      SELECT 
        is_break_available($1, 'Lunch', '2025-08-19 11:00:00'::timestamp without time zone) as lunch_available_11am
    `, [testAgentId]);
    
    console.log('   Lunch available at 11:00 AM:', testTimeResult.rows[0].lunch_available_11am);
    
    // Test with 10:30 AM (should be available soon)
    const testTimeResult2 = await pool.query(`
      SELECT 
        is_break_available_soon($1, 'Lunch', '2025-08-19 10:30:00'::timestamp without time zone) as lunch_available_soon_10_30
    `, [testAgentId]);
    
    console.log('   Lunch available soon at 10:30 AM:', testTimeResult2.rows[0].lunch_available_soon_10_30);
    
    // 6. Check the actual function source to see all conditions
    console.log('\n6️⃣ Checking function source for all conditions:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_available'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for specific conditions
      if (source.includes('break_already_taken')) {
        console.log('\n   📍 Found break_already_taken condition');
      }
      if (source.includes('status = \'active\'')) {
        console.log('   📍 Found active break status check');
      }
      if (source.includes('break_date')) {
        console.log('   📍 Found break_date condition');
      }
    }
    
    console.log('\n✅ Lunch break logic debug completed!');
    
  } catch (error) {
    console.error('❌ Error in lunch break logic debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugLunchBreakLogic();
