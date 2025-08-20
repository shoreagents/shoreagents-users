const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugTimeComparison() {
  try {
    console.log('🔍 Debugging Time Comparison Logic...\n');
    
    const testAgentId = 2;
    
    // Test the exact time comparison logic
    console.log('1️⃣ Direct time comparison test:');
    
    const testResult = await pool.query(`
      SELECT 
        '14:30:00'::TIME as test_time,
        '13:45:00'::TIME as break_start,
        '14:45:00'::TIME as break_end,
        ('14:30:00'::TIME >= '13:45:00'::TIME) as is_after_start,
        ('14:30:00'::TIME <= '14:45:00'::TIME) as is_before_end,
        ('14:30:00'::TIME >= '13:45:00'::TIME AND '14:30:00'::TIME <= '14:45:00'::TIME) as is_within_window
    `);
    
    const timeTest = testResult.rows[0];
    console.log(`   Test time: ${timeTest.test_time}`);
    console.log(`   Break start: ${timeTest.break_start}`);
    console.log(`   Break end: ${timeTest.break_end}`);
    console.log(`   Is after start: ${timeTest.is_after_start}`);
    console.log(`   Is before end: ${timeTest.is_before_end}`);
    console.log(`   Is within window: ${timeTest.is_within_window}`);
    
    // Test what the function is actually receiving
    console.log('\n2️⃣ Function input/output test:');
    
    const functionTest = await pool.query(`
      SELECT 
        ($1::timestamp without time zone)::TIME as extracted_time,
        is_break_available_now($2, 'Afternoon', $1::timestamp without time zone) as function_result
    `, ['2025-08-20 14:30:00', testAgentId]);
    
    const funcTest = functionTest.rows[0];
    console.log(`   Function extracted time: ${funcTest.extracted_time}`);
    console.log(`   Function result: ${funcTest.function_result}`);
    
    // Test the break window retrieval inside function
    console.log('\n3️⃣ Break window retrieval test:');
    
    const breakWindowTest = await pool.query(`
      SELECT * FROM calculate_break_windows($1) WHERE break_type = 'Afternoon'
    `, [testAgentId]);
    
    if (breakWindowTest.rows.length > 0) {
      const window = breakWindowTest.rows[0];
      console.log(`   Retrieved break window: ${window.start_time} - ${window.end_time}`);
      
      // Manual comparison
      const manualTest = await pool.query(`
        SELECT 
          '14:30:00'::TIME >= $1::TIME as manual_after_start,
          '14:30:00'::TIME <= $2::TIME as manual_before_end,
          ('14:30:00'::TIME >= $1::TIME AND '14:30:00'::TIME <= $2::TIME) as manual_within
      `, [window.start_time, window.end_time]);
      
      const manual = manualTest.rows[0];
      console.log(`   Manual comparison with retrieved window:`);
      console.log(`   After start: ${manual.manual_after_start}`);
      console.log(`   Before end: ${manual.manual_before_end}`);
      console.log(`   Within window: ${manual.manual_within}`);
    }
    
    // Test different times to see the pattern
    console.log('\n4️⃣ Testing multiple times:');
    
    const testTimes = [
      '2025-08-20 13:30:00', // 1:30 PM - before window
      '2025-08-20 13:45:00', // 1:45 PM - start of window
      '2025-08-20 14:00:00', // 2:00 PM - middle of window
      '2025-08-20 14:30:00', // 2:30 PM - should be in window
      '2025-08-20 14:45:00', // 2:45 PM - end of window
      '2025-08-20 15:00:00'  // 3:00 PM - after window
    ];
    
    for (const testTime of testTimes) {
      const timeLabel = testTime.split(' ')[1];
      const hourMin = timeLabel.substring(0, 5);
      
      const result = await pool.query(`
        SELECT is_break_available_now($1, 'Afternoon', $2::timestamp without time zone) as result
      `, [testAgentId, testTime]);
      
      const isAvailable = result.rows[0].result;
      console.log(`   ${hourMin}: ${isAvailable ? '✅ Available' : '❌ Not Available'}`);
    }
    
    console.log('\n🎯 Expected results:');
    console.log('   13:30: ❌ Not Available (before 1:45 PM start)');
    console.log('   13:45: ✅ Available (at start)');
    console.log('   14:00: ✅ Available (in window)');
    console.log('   14:30: ✅ Available (in window)');
    console.log('   14:45: ✅ Available (at end)');
    console.log('   15:00: ❌ Not Available (after 2:45 PM end)');
    
  } catch (error) {
    console.error('❌ Error debugging time comparison:', error.message);
  } finally {
    await pool.end();
  }
}

debugTimeComparison();
