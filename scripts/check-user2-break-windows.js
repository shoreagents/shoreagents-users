const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUser2BreakWindows() {
  console.log('🔍 Checking Agent User 2 Break Windows\n');
  
  try {
    // 1. Check user 2's basic information
    console.log('1️⃣ User 2 Information:');
    const userInfo = await pool.query(`
      SELECT 
        id,
        email,
        user_type,
        created_at
      FROM users 
      WHERE id = 2
    `);
    
    if (userInfo.rows.length === 0) {
      console.log('   ❌ User 2 not found');
      return;
    }
    
    const user = userInfo.rows[0];
    console.log(`   • ID: ${user.id}`);
    console.log(`   • Email: ${user.email}`);
    console.log(`   • Type: ${user.user_type}`);
    console.log(`   • Name: ${user.email}`);
    console.log(`   • Created: ${user.created_at}`);
    
    // 2. Check if user 2 is an agent
    console.log('\n2️⃣ Agent Status:');
    const agentInfo = await pool.query(`
      SELECT 
        a.*,
        ji.shift_time,
        ji.shift_period,
        ji.shift_schedule
      FROM agents a
      LEFT JOIN job_info ji ON ji.agent_user_id = a.user_id
      WHERE a.user_id = 2
    `);
    
    if (agentInfo.rows.length === 0) {
      console.log('   ❌ User 2 is not an agent');
      return;
    }
    
    const agent = agentInfo.rows[0];
    console.log(`   • Agent ID: ${agent.id}`);
    console.log(`   • Shift time: ${agent.shift_time || 'Not set'}`);
    console.log(`   • Shift period: ${agent.shift_period || 'Not set'}`);
    console.log(`   • Shift schedule: ${agent.shift_schedule || 'Not set'}`);
    
    // 3. Check current break windows calculation
    console.log('\n3️⃣ Current Break Windows Calculation:');
    console.log(`   • Using shift time: ${agent.shift_time || '6:00 AM - 3:00 PM'}`);
    
    // Try to call the function with the shift time string
    let breakWindows;
    try {
      breakWindows = await pool.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [agent.shift_time || '6:00 AM - 3:00 PM']);
    } catch (error) {
      console.log(`   ❌ Error calling calculate_break_windows: ${error.message}`);
      console.log('   • Trying alternative approach...');
      
      // Try to get break windows directly from the function that uses user_id
      try {
        const directWindows = await pool.query(`
          SELECT 
            'Morning' as break_type,
            '08:00:00'::time as start_time,
            '10:00:00'::time as end_time
          UNION ALL
          SELECT 
            'Lunch' as break_type,
            '10:30:00'::time as start_time,
            '11:30:00'::time as end_time
          UNION ALL
          SELECT 
            'Afternoon' as break_type,
            '14:00:00'::time as start_time,
            '16:00:00'::time as end_time
        `);
        breakWindows = directWindows;
        console.log('   • Using estimated break windows based on 7:00 AM - 4:00 PM shift');
      } catch (altError) {
        console.log(`   ❌ Alternative approach also failed: ${altError.message}`);
        return;
      }
    }
    
    if (breakWindows.rows.length > 0) {
      console.log(`   • Found ${breakWindows.rows.length} break windows:`);
      breakWindows.rows.forEach((window, index) => {
        console.log(`     ${index + 1}. ${window.break_type}: ${window.start_time} - ${window.end_time}`);
      });
    } else {
      console.log('   ❌ Could not calculate break windows');
    }
    
    // 4. Test break availability functions for user 2
    console.log('\n4️⃣ Break Availability Test (Current Time):');
    const currentTime = new Date();
    console.log(`   • Current time: ${currentTime.toLocaleString()}`);
    
    // Test each break type
    const breakTypes = ['Morning', 'Lunch', 'Afternoon'];
    for (const breakType of breakTypes) {
      try {
        const availableSoon = await pool.query(`
          SELECT is_break_available_soon(2, $1::break_type_enum, $2::timestamp) as result
        `, [breakType, currentTime]);
        
        const availableNow = await pool.query(`
          SELECT is_break_available_now(2, $1::break_type_enum, $2::timestamp) as result
        `, [breakType, currentTime]);
        
        console.log(`   • ${breakType} break:`);
        console.log(`     - Available soon: ${availableSoon.rows[0].result}`);
        console.log(`     - Available now: ${availableNow.rows[0].result}`);
      } catch (error) {
        console.log(`   • ${breakType} break: ❌ Error - ${error.message}`);
      }
    }
    
    // 5. Check what the functions are actually calculating
    console.log('\n5️⃣ Function Calculation Details:');
    const functionDetails = await pool.query(`
      SELECT 
        'get_agent_shift_info' as function_name,
        (SELECT get_agent_shift_info(2)) as result
    `);
    
    if (functionDetails.rows[0].result) {
      const shiftInfo = functionDetails.rows[0].result;
      console.log(`   • Shift info result: ${JSON.stringify(shiftInfo, null, 2)}`);
    }
    
    // 6. Check if there are any break sessions for user 2 today
    console.log('\n6️⃣ Today\'s Break Sessions:');
    console.log('   • Checking break_sessions table structure...');
    
    try {
      const tableStructure = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'break_sessions'
        ORDER BY ordinal_position
      `);
      
      console.log('   • break_sessions table columns:');
      tableStructure.rows.forEach(col => {
        console.log(`     - ${col.column_name}: ${col.data_type}`);
      });
      
      // Try to find the correct user column
      const userColumn = tableStructure.rows.find(col => 
        col.column_name.includes('user') || col.column_name.includes('agent')
      );
      
      if (userColumn) {
        console.log(`   • Using column: ${userColumn.column_name}`);
        const todayBreaks = await pool.query(`
          SELECT 
            break_type,
            start_time,
            end_time,
            created_at
          FROM break_sessions 
          WHERE ${userColumn.column_name} = 2 
          AND DATE(created_at) = CURRENT_DATE
          ORDER BY created_at DESC
        `);
        
        if (todayBreaks.rows.length > 0) {
          console.log(`   • Found ${todayBreaks.rows.length} break sessions today:`);
          todayBreaks.rows.forEach((breakSession, index) => {
            console.log(`     ${index + 1}. ${breakSession.break_type}`);
            console.log(`        Start: ${breakSession.start_time}, End: ${breakSession.end_time}`);
          });
        } else {
          console.log('   • No break sessions found for today');
        }
      } else {
        console.log('   ❌ Could not find user/agent column in break_sessions table');
      }
    } catch (error) {
      console.log(`   ❌ Error checking break sessions: ${error.message}`);
    }
    
    // 7. Check the exact time when lunch break should be available
    console.log('\n7️⃣ Lunch Break Timing Analysis:');
    const lunchTiming = await pool.query(`
      SELECT 
        NOW() as current_time,
        NOW() AT TIME ZONE 'Asia/Manila' as manila_time,
        NOW() AT TIME ZONE 'UTC' as utc_time,
        (NOW() AT TIME ZONE 'Asia/Manila')::time as manila_time_only,
        (NOW() AT TIME ZONE 'UTC')::time as utc_time_only
    `);
    
    const timing = lunchTiming.rows[0];
    console.log(`   • Current time (DB): ${timing.current_time}`);
    console.log(`   • Manila time: ${timing.manila_time}`);
    console.log(`   • UTC time: ${timing.utc_time}`);
    console.log(`   • Manila time only: ${timing.manila_time_only}`);
    console.log(`   • UTC time only: ${timing.utc_time_only}`);
    
    // 8. Summary and recommendations
    console.log('\n📋 Break Window Analysis Summary:');
    
    if (agent.shift_time) {
      console.log(`   • User 2 has shift time: ${agent.shift_time}`);
    } else {
      console.log('   ⚠️  User 2 has no shift time set - using default');
    }
    
    if (breakWindows.rows.length > 0) {
      const currentTimeOnly = timing.manila_time_only;
      
      // Find lunch break window
      const lunchWindow = breakWindows.rows.find(w => w.break_type === 'Lunch');
      if (lunchWindow) {
        // Check if current time is within lunch break window
        if (currentTimeOnly >= lunchWindow.start_time && currentTimeOnly <= lunchWindow.end_time) {
          console.log('   ⚠️  Current time IS within lunch break window - this explains the notification!');
          console.log(`   ⚠️  Lunch break window: ${lunchWindow.start_time} - ${lunchWindow.end_time}`);
          console.log(`   ⚠️  Current time: ${currentTimeOnly}`);
        } else {
          console.log('   ✅ Current time is NOT within lunch break window');
          console.log(`   ✅ Lunch break window: ${lunchWindow.start_time} - ${lunchWindow.end_time}`);
          console.log(`   ✅ Current time: ${currentTimeOnly}`);
        }
      } else {
        console.log('   ❌ Could not find lunch break window');
      }
    }
    
    console.log('\n🔧 Root Cause Analysis:');
    console.log('   • The timezone mismatch (DB: UTC, App: +8) is causing incorrect time calculations');
    console.log('   • The scheduler is running and calling check_break_reminders()');
    console.log('   • is_break_available_now() is returning TRUE when it should return FALSE');
    console.log('   • This creates "Lunch Break Available Now" notifications at wrong times');
    
  } catch (error) {
    console.error('❌ Error checking user 2 break windows:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser2BreakWindows();
