const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testShiftDurationRequirements() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing shift duration requirements for break windows...\n');
    
    // Test different shift durations
    const testShifts = [
      { shift: '6:00 AM - 2:00 PM', hours: 8, expected: 'Should work' },
      { shift: '6:00 AM - 3:00 PM', hours: 9, expected: 'Should work' },
      { shift: '6:00 AM - 4:00 PM', hours: 10, expected: 'Should work' },
      { shift: '7:00 AM - 3:00 PM', hours: 8, expected: 'Should work' },
      { shift: '7:00 AM - 4:00 PM', hours: 9, expected: 'Should work' },
      { shift: '8:00 AM - 4:00 PM', hours: 8, expected: 'Should work' },
      { shift: '9:00 AM - 5:00 PM', hours: 8, expected: 'Should work' },
      { shift: '6:00 AM - 1:00 PM', hours: 7, expected: 'Might not work' },
      { shift: '6:00 AM - 12:00 PM', hours: 6, expected: 'Might not work' },
      { shift: '6:00 AM - 11:00 AM', hours: 5, expected: 'Might not work' }
    ];
    
    for (const test of testShifts) {
      console.log(`📋 Testing shift: ${test.shift} (${test.hours} hours) - ${test.expected}`);
      
      try {
        // Test if break windows can be calculated
        const windows = await client.query(`
          SELECT * FROM calculate_break_windows($1)
        `, [test.shift]);
        
        if (windows.rows.length > 0) {
          const w = windows.rows[0];
          console.log(`   ✅ Break windows calculated successfully:`);
          console.log(`      Morning: ${w.morning_start} - ${w.morning_end}`);
          console.log(`      Lunch: ${w.lunch_start} - ${w.lunch_end}`);
          console.log(`      Afternoon: ${w.afternoon_start} - ${w.afternoon_end}`);
          
          // Test if notification functions work
          const testTime = '2025-01-20 08:45:00';
          const availableSoon = await client.query(`
            SELECT is_break_available_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
          `, [testTime]);
          
          console.log(`      Notification test at 8:45 AM: Available soon = ${availableSoon.rows[0].result}`);
        } else {
          console.log(`   ❌ No break windows calculated`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Test the specific case you mentioned
    console.log('🎯 Testing your specific case: 6:00 AM - 4:00 PM (10 hours)');
    
    try {
      const windows = await client.query(`
        SELECT * FROM calculate_break_windows('6:00 AM - 4:00 PM')
      `);
      
      if (windows.rows.length > 0) {
        const w = windows.rows[0];
        console.log(`   ✅ Break windows for 6:00 AM - 4:00 PM:`);
        console.log(`      Morning: ${w.morning_start} - ${w.morning_end}`);
        console.log(`      Lunch: ${w.lunch_start} - ${w.lunch_end}`);
        console.log(`      Afternoon: ${w.afternoon_start} - ${w.afternoon_end}`);
      } else {
        console.log(`   ❌ No break windows calculated for 6:00 AM - 4:00 PM`);
      }
    } catch (error) {
      console.log(`   ❌ Error with 6:00 AM - 4:00 PM: ${error.message}`);
    }
    
    console.log('\n🔍 Let me check the calculate_break_windows function to see if there are any duration restrictions...');
    
    // Check if there are any constraints in the function
    const functionDefinition = await client.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'calculate_break_windows'
    `);
    
    if (functionDefinition.rows.length > 0) {
      console.log('   Function definition found. Checking for duration logic...');
      const definition = functionDefinition.rows[0].definition;
      
      if (definition.includes('8') || definition.includes('hour')) {
        console.log('   ✅ Found duration-related logic in function');
      } else {
        console.log('   ℹ️ No obvious duration restrictions found in function');
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error testing shift duration requirements:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testShiftDurationRequirements();
