#!/usr/bin/env node
/*
 * Debug Break Timing Logic
 * This script shows exactly what's happening with time calculations
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugBreakTiming() {
  try {
    console.log('🔍 Debugging Break Timing Logic...\n');
    
    // 1. Check current time
    const now = new Date();
    console.log(`🕐 Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`   UTC time: ${now.toISOString()}`);
    
    // 2. Test the calculate_break_windows function
    console.log('\n2️⃣ Testing calculate_break_windows function:');
    try {
      const breakWindowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows('6:00 AM - 3:00 PM')
      `);
      console.log('   Break windows for 6:00 AM - 3:00 PM shift:');
      console.log(`     Morning: ${breakWindowsResult.rows[0].morning_start} - ${breakWindowsResult.rows[0].morning_end}`);
      console.log(`     Lunch: ${breakWindowsResult.rows[0].lunch_start} - ${breakWindowsResult.rows[0].lunch_end}`);
      console.log(`     Afternoon: ${breakWindowsResult.rows[0].afternoon_start} - ${breakWindowsResult.rows[0].afternoon_end}`);
    } catch (error) {
      console.log(`   ❌ Break windows error: ${error.message}`);
    }
    
    // 3. Test the is_break_available function step by step
    console.log('\n3️⃣ Testing is_break_available step by step:');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    try {
      // Get agent shift info
      const shiftInfoResult = await pool.query(`
        SELECT * FROM get_agent_shift_info($1)
      `, [testAgentId]);
      
      console.log('   Agent shift info:', shiftInfoResult.rows[0]);
      
      // Check if break was already taken today
      const breakTakenResult = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM break_sessions 
          WHERE agent_user_id = $1 
          AND break_type = 'Lunch' 
          AND break_date = (NOW() AT TIME ZONE 'Asia/Manila')::DATE
        ) as break_already_taken
      `, [testAgentId]);
      
      console.log('   Lunch break already taken today:', breakTakenResult.rows[0].break_already_taken);
      
      // Get break windows
      const windowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [shiftInfoResult.rows[0].shift_time]);
      
      console.log('   Break windows:', windowsResult.rows[0]);
      
      // Check current time vs lunch break time
      const currentTimeResult = await pool.query(`
        SELECT 
          NOW() AT TIME ZONE 'Asia/Manila' as current_time,
          $1::time as lunch_start,
          $2::time as lunch_end,
          (NOW() AT TIME ZONE 'Asia/Manila')::time as current_time_only
      `, [windowsResult.rows[0].lunch_start, windowsResult.rows[0].lunch_end]);
      
      console.log('   Time comparison:', currentTimeResult.rows[0]);
      
      // Manual calculation
      const currentTime = currentTimeResult.rows[0].current_time_only;
      const lunchStart = currentTimeResult.rows[0].lunch_start;
      const lunchEnd = currentTimeResult.rows[0].lunch_end;
      
      console.log('   Manual calculation:');
      console.log(`     Current time: ${currentTime}`);
      console.log(`     Lunch start: ${lunchStart}`);
      console.log(`     Lunch end: ${lunchEnd}`);
      console.log(`     Is current time >= lunch start? ${currentTime >= lunchStart}`);
      console.log(`     Is current time <= lunch end? ${currentTime <= lunchEnd}`);
      console.log(`     Should lunch be available? ${currentTime >= lunchStart && currentTime <= lunchEnd}`);
      
    } catch (error) {
      console.log(`   ❌ Step-by-step test error: ${error.message}`);
    }
    
    // 4. Test with a specific time that should work
    console.log('\n4️⃣ Testing with specific time (10:30 AM - should be lunch available):');
    try {
      const specificTimeResult = await pool.query(`
        SELECT 
          is_break_available($1, 'Lunch', '2025-08-19 10:30:00'::timestamp AT TIME ZONE 'Asia/Manila') as lunch_available_10_30
      `, [testAgentId]);
      
      console.log('   Lunch available at 10:30 AM:', specificTimeResult.rows[0].lunch_available_10_30);
      
      // Test with current time
      const currentTimeResult = await pool.query(`
        SELECT 
          is_break_available($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available_now
      `, [testAgentId]);
      
      console.log('   Lunch available now:', currentTimeResult.rows[0].lunch_available_now);
      
    } catch (error) {
      console.log(`   ❌ Specific time test error: ${error.message}`);
    }
    
    // 5. Check the actual function source code
    console.log('\n5️⃣ Checking function source code:');
    try {
      const functionSourceResult = await pool.query(`
        SELECT pg_get_functiondef(oid) as source
        FROM pg_proc 
        WHERE proname = 'is_break_available'
        LIMIT 1
      `);
      
      if (functionSourceResult.rows.length > 0) {
        console.log('   Function source found (first 500 chars):');
        console.log('   ' + functionSourceResult.rows[0].source.substring(0, 500) + '...');
    } else {
        console.log('   ❌ Function source not found');
      }
    } catch (error) {
      console.log(`   ❌ Function source check error: ${error.message}`);
    }
    
    console.log('\n✅ Break timing debug completed!');
    
  } catch (error) {
    console.error('❌ Error in break timing debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugBreakTiming();
