const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testUpdateUser2Shift() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing direct update of User 2 shift to 6:00 AM - 4:00 PM...\n');
    
    // 1. Check current state
    console.log('1️⃣ Current User 2 shift:');
    const currentShift = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 2
    `);
    
    if (currentShift.rows.length > 0) {
      console.log(`   Current shift: ${currentShift.rows[0].shift_time}`);
      console.log(`   Last updated: ${currentShift.rows[0].updated_at}`);
    }
    
    // 2. Try to update to 6:00 AM - 4:00 PM
    console.log('\n2️⃣ Updating shift to 6:00 AM - 4:00 PM...');
    
    try {
      const updateResult = await client.query(`
        UPDATE job_info 
        SET shift_time = '6:00 AM - 4:00 PM', updated_at = NOW()
        WHERE agent_user_id = 2
        RETURNING *
      `);
      
      if (updateResult.rows.length > 0) {
        console.log('   ✅ Update successful!');
        console.log(`   New shift time: ${updateResult.rows[0].shift_time}`);
        console.log(`   Updated at: ${updateResult.rows[0].updated_at}`);
      } else {
        console.log('   ❌ Update failed - no rows affected');
      }
    } catch (updateError) {
      console.log(`   ❌ Update error: ${updateError.message}`);
    }
    
    // 3. Verify the update
    console.log('\n3️⃣ Verifying the update...');
    const verifyShift = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 2
    `);
    
    if (verifyShift.rows.length > 0) {
      console.log(`   Verified shift time: ${verifyShift.rows[0].shift_time}`);
    }
    
    // 4. Test break windows with new shift
    console.log('\n4️⃣ Testing break windows with new shift...');
    const newWindows = await client.query(`
      SELECT * FROM calculate_break_windows('6:00 AM - 4:00 PM')
    `);
    
    if (newWindows.rows.length > 0) {
      const windows = newWindows.rows[0];
      console.log(`   ✅ Break windows calculated:`);
      console.log(`      Morning: ${windows.morning_start} - ${windows.morning_end}`);
      console.log(`      Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
      console.log(`      Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
    }
    
    // 5. Test get_agent_shift_info function
    console.log('\n5️⃣ Testing get_agent_shift_info function...');
    const shiftInfo = await client.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (shiftInfo.rows.length > 0) {
      console.log(`   ✅ Function result: ${shiftInfo.rows[0].shift_time}`);
    }
    
    // 6. Test notification functions
    console.log('\n6️⃣ Testing notification functions...');
    
    // Test at 7:45 AM (15 min before morning break)
    const testTime1 = '2025-01-20 07:45:00';
    const availableSoon1 = await client.query(`
      SELECT is_break_available_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime1]);
    
    console.log(`   Testing at 7:45 AM (15 min before morning break):`);
    console.log(`     Available soon: ${availableSoon1.rows[0].result}`);
    
    // Test at 8:00 AM (morning break starts)
    const testTime2 = '2025-01-20 08:00:00';
    const availableNow1 = await client.query(`
      SELECT is_break_available_now(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [testTime2]);
    
    console.log(`   Testing at 8:00 AM (morning break starts):`);
    console.log(`     Available now: ${availableNow1.rows[0].result}`);
    
    // 7. Check if there are any database triggers or constraints
    console.log('\n7️⃣ Checking for database constraints...');
    
    try {
      const constraints = await client.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'job_info'
      `);
      
      if (constraints.rows.length > 0) {
        console.log('   Found constraints:');
        constraints.rows.forEach((constraint, index) => {
          console.log(`     ${index + 1}. ${constraint.constraint_type}: ${constraint.constraint_name}`);
        });
      } else {
        console.log('   No constraints found on job_info table');
      }
    } catch (constraintError) {
      console.log(`   Error checking constraints: ${constraintError.message}`);
    }
    
    // 8. Check for triggers
    console.log('\n8️⃣ Checking for triggers...');
    
    try {
      const triggers = await client.query(`
        SELECT 
          trigger_name,
          event_manipulation,
          action_statement
        FROM information_schema.triggers
        WHERE event_object_table = 'job_info'
      `);
      
      if (triggers.rows.length > 0) {
        console.log('   Found triggers:');
        triggers.rows.forEach((trigger, index) => {
          console.log(`     ${index + 1}. ${trigger.trigger_name} (${trigger.event_manipulation})`);
        });
      } else {
        console.log('   No triggers found on job_info table');
      }
    } catch (triggerError) {
      console.log(`   Error checking triggers: ${triggerError.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error testing shift update:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testUpdateUser2Shift();
