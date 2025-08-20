const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testShiftTimeChanges() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing if shift time changes affect break windows for User 2...\n');
    
    // 1. Check current shift time for User 2
    console.log('1️⃣ Current User 2 shift configuration:');
    const currentShift = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 2
    `);
    
    if (currentShift.rows.length > 0) {
      console.log('   Current shift time:', currentShift.rows[0].shift_time);
      console.log('   Employee ID:', currentShift.rows[0].employee_id);
      console.log('   Job Title:', currentShift.rows[0].job_title);
    } else {
      console.log('   ❌ No job_info found for User 2');
      return;
    }
    
    // 2. Test current break windows
    console.log('\n2️⃣ Current break windows:');
    const currentWindows = await client.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [currentShift.rows[0].shift_time]);
    
    if (currentWindows.rows.length > 0) {
      const windows = currentWindows.rows[0];
      console.log(`   Morning: ${windows.morning_start} - ${windows.morning_end}`);
      console.log(`   Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
      console.log(`   Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
    }
    
    // 3. Test get_agent_shift_info function
    console.log('\n3️⃣ Testing get_agent_shift_info function:');
    const shiftInfo = await client.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (shiftInfo.rows.length > 0) {
      console.log('   Shift info from function:', shiftInfo.rows[0].shift_time);
      console.log('   Shift period:', shiftInfo.rows[0].shift_period);
    } else {
      console.log('   ❌ get_agent_shift_info returned no results');
    }
    
    // 4. Change shift time and test if break windows update
    console.log('\n4️⃣ Testing shift time change...');
    const newShiftTime = '7:00 AM - 4:00 PM';
    console.log(`   Changing shift time to: ${newShiftTime}`);
    
    await client.query(`
      UPDATE job_info 
      SET shift_time = $1, updated_at = NOW()
      WHERE agent_user_id = 2
    `, [newShiftTime]);
    
    console.log('   ✅ Shift time updated in database');
    
    // 5. Test new break windows
    console.log('\n5️⃣ New break windows after shift change:');
    const newWindows = await client.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [newShiftTime]);
    
    if (newWindows.rows.length > 0) {
      const windows = newWindows.rows[0];
      console.log(`   Morning: ${windows.morning_start} - ${windows.morning_end}`);
      console.log(`   Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
      console.log(`   Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
    }
    
    // 6. Test get_agent_shift_info after change
    console.log('\n6️⃣ Testing get_agent_shift_info after change:');
    const newShiftInfo = await client.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (newShiftInfo.rows.length > 0) {
      console.log('   New shift info from function:', newShiftInfo.rows[0].shift_time);
      console.log('   Shift period:', newShiftInfo.rows[0].shift_period);
    }
    
    // 7. Test break notification functions with new shift
    console.log('\n7️⃣ Testing break notification functions with new shift:');
    
    // Test at 8:45 AM (15 min before morning break with new shift)
    const testTime = '2025-01-20 08:45:00';
    console.log(`   Testing at 8:45 AM (should be 15 min before morning break):`);
    
    const availableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    const availableNow = await client.query(`
      SELECT is_break_available_now(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime]);
    
    console.log(`     Available soon: ${availableSoon.rows[0].result}`);
    console.log(`     Available now: ${availableNow.rows[0].result}`);
    
    // Test at 9:00 AM (should be morning break start with new shift)
    const testTime2 = '2025-01-20 09:00:00';
    console.log(`   Testing at 9:00 AM (should be morning break start):`);
    
    const availableSoon2 = await client.query(`
      SELECT is_break_available_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime2]);
    
    const availableNow2 = await client.query(`
      SELECT is_break_available_now(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime2]);
    
    console.log(`     Available soon: ${availableSoon2.rows[0].result}`);
    console.log(`     Available now: ${availableNow2.rows[0].result}`);
    
    // 8. Restore original shift time
    console.log('\n8️⃣ Restoring original shift time...');
    await client.query(`
      UPDATE job_info 
      SET shift_time = $1, updated_at = NOW()
      WHERE agent_user_id = 2
    `, [currentShift.rows[0].shift_time]);
    
    console.log('   ✅ Original shift time restored');
    
    // 9. Check if the calculate_break_windows function is working correctly
    console.log('\n9️⃣ Testing calculate_break_windows function directly:');
    
    const testShifts = [
      '6:00 AM - 3:00 PM',
      '7:00 AM - 4:00 PM', 
      '8:00 AM - 5:00 PM',
      '9:00 AM - 6:00 PM'
    ];
    
    for (const shift of testShifts) {
      console.log(`   Shift: ${shift}`);
      const windows = await client.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [shift]);
      
      if (windows.rows.length > 0) {
        const w = windows.rows[0];
        console.log(`     Morning: ${w.morning_start} - ${w.morning_end}`);
        console.log(`     Lunch: ${w.lunch_start} - ${w.lunch_end}`);
        console.log(`     Afternoon: ${w.afternoon_start} - ${w.afternoon_end}`);
      } else {
        console.log('     ❌ No break windows calculated');
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing shift time changes:', error.message);
    console.error('\n🔍 Error details:', error);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testShiftTimeChanges();
