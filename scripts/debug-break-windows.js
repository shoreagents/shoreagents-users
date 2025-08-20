const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugBreakWindows() {
  console.log('🔍 Debugging break windows and shift configuration...\n');
  
  try {
    // 1. Test database connection
    console.log('1️⃣ Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connected successfully\n');
    
    // 2. Check the structure of the users table
    console.log('2️⃣ Checking users table structure...');
    const tableStructureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('   Users table columns:');
    tableStructureResult.rows.forEach(col => {
      console.log(`      ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');
    
    // 3. Check user 1's basic information
    console.log('3️⃣ Checking user 1 information...');
    const userResult = await pool.query(`
      SELECT *
      FROM users 
      WHERE id = 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('   ❌ User 1 not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('   ✅ User found:');
    Object.keys(user).forEach(key => {
      console.log(`      ${key}: ${user[key]}`);
    });
    console.log('');
    
    // 4. Check if user is an agent
    console.log('4️⃣ Checking agent status...');
    const agentResult = await pool.query(`
      SELECT * FROM agents WHERE user_id = 1
    `);
    
    if (agentResult.rows.length === 0) {
      console.log('   ❌ User 1 is not an agent');
      return;
    }
    
    console.log('   ✅ User 1 is an agent');
    console.log(`      Agent data:`, agentResult.rows[0]);
    console.log('');
    
    // 5. Check job_info table structure
    console.log('5️⃣ Checking job_info table structure...');
    const jobInfoStructureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'job_info' 
      ORDER BY ordinal_position
    `);
    
    console.log('   Job_info table columns:');
    jobInfoStructureResult.rows.forEach(col => {
      console.log(`      ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    console.log('');
    
    // 6. Check job_info for shift configuration
    console.log('6️⃣ Checking job_info for shift configuration...');
    const jobInfoResult = await pool.query(`
      SELECT * FROM job_info LIMIT 5
    `);
    
    if (jobInfoResult.rows.length === 0) {
      console.log('   ❌ No job_info records found');
      return;
    }
    
    console.log('   ✅ Job info records found:');
    jobInfoResult.rows.forEach((job, index) => {
      console.log(`      Record ${index + 1}:`, job);
    });
    console.log('');
    
    // 7. Test get_agent_shift_info function
    console.log('7️⃣ Testing get_agent_shift_info function...');
    const shiftInfoResult = await pool.query(`
      SELECT * FROM get_agent_shift_info(1)
    `);
    
    if (shiftInfoResult.rows.length === 0) {
      console.log('   ❌ get_agent_shift_info returned no results');
      return;
    }
    
    const shiftInfo = shiftInfoResult.rows[0];
    console.log('   ✅ Shift info retrieved:');
    console.log(`      Shift time: ${shiftInfo.shift_time}`);
    console.log(`      Shift period: ${shiftInfo.shift_period}`);
    console.log(`      Shift start: ${shiftInfo.shift_start}`);
    console.log(`      Shift end: ${shiftInfo.shift_end}`);
    console.log('');
    
    // 8. Test calculate_break_windows function
    console.log('8️⃣ Testing calculate_break_windows function...');
    const breakWindowsResult = await pool.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [shiftInfo.shift_time]);
    
    if (breakWindowsResult.rows.length === 0) {
      console.log('   ❌ calculate_break_windows returned no results');
      return;
    }
    
    const breakWindows = breakWindowsResult.rows[0];
    console.log('   ✅ Break windows calculated:');
    console.log(`      Morning: ${breakWindows.morning_start} - ${breakWindows.morning_end}`);
    console.log(`      Lunch: ${breakWindows.lunch_start} - ${breakWindows.lunch_end}`);
    console.log(`      Afternoon: ${breakWindows.afternoon_start} - ${breakWindows.afternoon_end}`);
    console.log('');
    
    // 9. Test break functions at specific times
    console.log('9️⃣ Testing break functions at specific times...');
    
    const testTimes = [
      '2025-08-20 09:45:00', // 15 minutes before lunch break
      '2025-08-20 10:00:00', // Lunch break starts
      '2025-08-20 10:01:00', // 1 minute after start
      '2025-08-20 10:14:00', // 1 minute before end
      '2025-08-20 10:15:00', // Lunch break ends
    ];
    
    for (const testTime of testTimes) {
      console.log(`   Testing at ${testTime}:`);
      
      // Test is_break_available_soon
      const availableSoonResult = await pool.query(`
        SELECT is_break_available_soon(1, 'Lunch'::break_type_enum, $1::timestamp) as available_soon
      `, [testTime]);
      
      // Test is_break_available_now
      const availableNowResult = await pool.query(`
        SELECT is_break_available_now(1, 'Lunch'::break_type_enum, $1::timestamp) as available_now
      `, [testTime]);
      
      console.log(`      Available soon: ${availableSoonResult.rows[0].available_soon}`);
      console.log(`      Available now: ${availableNowResult.rows[0].available_now}`);
      console.log('');
    }
    
    // 10. Check if any breaks were already taken today
    console.log('10️⃣ Checking if breaks were already taken today...');
    const breaksTakenResult = await pool.query(`
      SELECT break_type, break_date, start_time, end_time
      FROM break_sessions 
      WHERE agent_user_id = 1 
      AND break_date = CURRENT_DATE
      ORDER BY start_time
    `);
    
    if (breaksTakenResult.rows.length === 0) {
      console.log('   ✅ No breaks taken today');
    } else {
      console.log(`   📝 ${breaksTakenResult.rows.length} breaks taken today:`);
      breaksTakenResult.rows.forEach((breakSession, index) => {
        console.log(`      ${index + 1}. ${breakSession.break_type}: ${breakSession.start_time} - ${breakSession.end_time}`);
      });
    }
    console.log('');
    
    // 11. Summary and recommendations
    console.log('🎯 Debug Summary:');
    console.log('   • User 1 exists and is an agent ✅');
    console.log(`   • Shift time: ${shiftInfo.shift_time}`);
    console.log(`   • Break windows calculated successfully ✅`);
    console.log(`   • Lunch break window: ${breakWindows.lunch_start} - ${breakWindows.lunch_end}`);
    
    if (breakWindows.lunch_start && breakWindows.lunch_end) {
      console.log('\n🔔 Expected behavior:');
      console.log(`   • At ${breakWindows.lunch_start}: "Lunch break is now available" ✅`);
      console.log(`   • 15 minutes before ${breakWindows.lunch_start}: "Lunch break available soon" ✅`);
      console.log(`   • 5 minutes before ${breakWindows.lunch_end}: "Lunch break ending soon" ✅`);
    } else {
      console.log('\n❌ Issue detected:');
      console.log('   • Break windows are not properly calculated');
      console.log('   • Check the calculate_break_windows function');
    }
    
  } catch (error) {
    console.error('\n❌ Error debugging break windows:', error.message);
    console.error('\n🔍 Error details:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugBreakWindows();
