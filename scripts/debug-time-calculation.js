const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugTimeCalculation() {
  try {
    console.log('🔍 Debugging Time Calculation in Database Function...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    const testTime = '2025-08-20 13:45:00'; // 1:45 PM
    
    console.log('1️⃣ Raw time values:');
    console.log(`   Test time: ${testTime}`);
    console.log(`   Test time type: ${typeof testTime}`);
    
    // Check what the function actually receives
    console.log('\n2️⃣ Testing function with debug output:');
    
    // First, let's see what the function returns without the debug notices
    const result = await pool.query(`
      SELECT 
        is_break_window_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
    `, [testAgentId, testTime]);
    
    console.log(`   Function result: ${result.rows[0].lunch_ending_soon}`);
    
    // Now let's manually check the time conversion
    console.log('\n3️⃣ Manual time conversion check:');
    const timeConversionResult = await pool.query(`
      SELECT 
        $1::timestamp without time zone as input_time,
        ($1::timestamp without time zone AT TIME ZONE 'Asia/Manila')::TIME as converted_time,
        '14:00:00'::TIME as break_end_time,
        EXTRACT(EPOCH FROM ('14:00:00'::TIME - ($1::timestamp without time zone AT TIME ZONE 'Asia/Manila')::TIME)) / 60 as minutes_until_end
    `, [testTime]);
    
    const timeData = timeConversionResult.rows[0];
    console.log(`   Input time: ${timeData.input_time}`);
    console.log(`   Converted time: ${timeData.converted_time}`);
    console.log(`   Break end time: ${timeData.break_end_time}`);
    console.log(`   Minutes until end: ${timeData.minutes_until_end}`);
    
    // Check break windows
    console.log('\n4️⃣ Break windows check:');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1) WHERE break_type = 'Lunch'
    `, [testAgentId]);
    
    if (breakWindowsResult.rows.length > 0) {
      const lunchWindow = breakWindowsResult.rows[0];
      console.log(`   Lunch break window: ${lunchWindow.start_time} - ${lunchWindow.end_time}`);
      
      // Test the exact calculation the function should be doing
      const calculationResult = await pool.query(`
        SELECT 
          EXTRACT(EPOCH FROM ($1::TIME - $2::TIME)) / 60 as minutes_until_end
      `, [lunchWindow.end_time, timeData.converted_time]);
      
      console.log(`   Manual calculation result: ${calculationResult.rows[0].minutes_until_end} minutes`);
    }
    
  } catch (error) {
    console.error('❌ Error debugging time calculation:', error.message);
  } finally {
    await pool.end();
  }
}

debugTimeCalculation();
