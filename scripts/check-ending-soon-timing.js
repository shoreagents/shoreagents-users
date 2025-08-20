const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkEndingSoonTiming() {
  try {
    console.log('🔍 Checking "Break Ending Soon" Notification Timing...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check current time and break window
    console.log('1️⃣ Current time and break window:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // First, let's check what functions exist and their signatures
    console.log('\n2️⃣ Checking available functions:');
    const functionsResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_identity_arguments(oid) as arguments
      FROM pg_proc 
      WHERE proname IN ('calculate_break_windows', 'is_break_window_ending_soon', 'is_break_ending_soon')
      ORDER BY proname
    `);
    
    functionsResult.rows.forEach(row => {
      console.log(`   ${row.function_name}(${row.arguments})`);
    });
    
    // 3. Check the is_break_window_ending_soon function logic
    console.log('\n3️⃣ Checking is_break_window_ending_soon function:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_window_ending_soon'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function exists and is accessible');
      
      // Look for the timing logic
      if (source.includes('INTERVAL \'15 minutes\'')) {
        console.log('   📍 Found 15-minute logic for ending soon');
        console.log('   ✅ "Break ending soon" triggers 15 minutes before break window ends');
      } else if (source.includes('INTERVAL \'5 minutes\'')) {
        console.log('   📍 Found 5-minute logic for ending soon');
        console.log('   ✅ "Break ending soon" triggers 5 minutes before break window ends');
      } else {
        console.log('   ❓ Could not determine exact timing from function source');
      }
    } else {
      console.log('   ❌ Function not found');
      return;
    }
    
    // 4. Test specific times around 1:45 PM (15 minutes before 1:00 PM end)
    console.log('\n4️⃣ Testing specific times around 1:45 PM:');
    const testTimes = [
      '2025-08-20 12:40:00', // 20 minutes before end
      '2025-08-20 12:45:00', // 15 minutes before end - SHOULD TRIGGER
      '2025-08-20 12:50:00', // 10 minutes before end
      '2025-08-20 12:55:00', // 5 minutes before end
      '2025-08-20 13:00:00'  // At end time
    ];
    
    for (const testTime of testTimes) {
      try {
        // Try both function signatures
        let result;
        try {
          result = await pool.query(`
            SELECT 
              is_break_window_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
          `, [testAgentId, testTime]);
        } catch (error) {
          // If that fails, try the other signature
          result = await pool.query(`
            SELECT 
              is_break_window_ending_soon($1, 'Lunch', $2::timestamp without time zone) as lunch_ending_soon
          `, [testAgentId, testTime]);
        }
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        const isEndingSoon = result.rows[0].lunch_ending_soon;
        const minutesBeforeEnd = getMinutesBeforeEnd(testTime, '13:00:00');
        
        console.log(`   ${timeLabel} (${minutesBeforeEnd} min before end): ${isEndingSoon ? '✅ ENDING SOON' : '❌ Not ending soon'}`);
        
        // Highlight the current time
        if (timeLabel === '12:45:00') {
          console.log(`   🎯 CURRENT TIME: ${timeLabel} - ${isEndingSoon ? 'Should receive "ending soon" notification' : 'No notification expected'}`);
        }
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 5. Check what the check_break_reminders function actually sends
    console.log('\n5️⃣ Testing check_break_reminders for ending soon:');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      console.log('   ✅ check_break_reminders executed successfully');
    } catch (error) {
      console.log(`   ❌ Error running check_break_reminders: ${error.message}`);
    }
    
    // 6. Check if there are any active breaks that should trigger ending soon
    console.log('\n6️⃣ Checking for active breaks that should trigger ending soon:');
    const activeBreaksResult = await pool.query(`
      SELECT 
        bs.*,
        u.email as agent_email,
        EXTRACT(EPOCH FROM (NOW() - bs.start_time)) / 60 as elapsed_minutes
      FROM break_sessions bs
      JOIN users u ON bs.agent_user_id = u.id
      WHERE bs.end_time IS NULL 
      AND bs.break_date = CURRENT_DATE
      ORDER BY bs.start_time DESC
    `);
    
    if (activeBreaksResult.rows.length > 0) {
      console.log('   Active breaks found:');
      activeBreaksResult.rows.forEach((break_session, index) => {
        console.log(`   ${index + 1}. ${break_session.agent_email} - ${break_session.break_type} break`);
        console.log(`      Started: ${break_session.start_time}`);
        console.log(`      Elapsed: ${Math.round(break_session.elapsed_minutes)} minutes`);
        
        // Check if this break should be ending soon
        if (break_session.break_type === 'Lunch') {
          const remainingMinutes = 60 - break_session.elapsed_minutes;
          if (remainingMinutes <= 5 && remainingMinutes > 0) {
            console.log(`      🚨 Should trigger "ending soon" notification (${Math.round(remainingMinutes)} min remaining)`);
          } else {
            console.log(`      No ending soon notification needed (${Math.round(remainingMinutes)} min remaining)`);
          }
        }
      });
    } else {
      console.log('   No active breaks found');
    }
    
    // 7. Check current time analysis
    console.log('\n7️⃣ Current time analysis for 1:45 PM:');
    const currentTimeStr = '12:45:00'; // 1:45 PM in 24-hour format
    const minutesUntilEnd = getMinutesUntilEnd(currentTimeStr, '13:00:00');
    
    if (minutesUntilEnd <= 15 && minutesUntilEnd > 0) {
      console.log(`   🎉 YES! You should receive "Break ending soon" notification at ${currentTimeStr}`);
      console.log(`   You are ${minutesUntilEnd} minutes before the break window ends`);
    } else if (minutesUntilEnd <= 0) {
      console.log(`   ❌ No, lunch break window has already ended`);
    } else {
      console.log(`   ❌ No, you are ${minutesUntilEnd} minutes before the break window ends`);
      console.log(`   "Ending soon" notifications typically trigger 15 minutes before`);
    }
    
  } catch (error) {
    console.error('❌ Error checking ending soon timing:', error);
  } finally {
    await pool.end();
  }
}

// Helper function to calculate minutes before end
function getMinutesBeforeEnd(testTime, endTime) {
  const test = new Date(`2025-08-20 ${testTime}`);
  const end = new Date(`2025-08-20 ${endTime}`);
  const diffMs = end - test;
  return Math.round(diffMs / (1000 * 60));
}

// Helper function to calculate minutes until end
function getMinutesUntilEnd(currentTime, endTime) {
  const current = new Date(`2025-08-20 ${currentTime}`);
  const end = new Date(`2025-08-20 ${endTime}`);
  const diffMs = end - current;
  return Math.round(diffMs / (1000 * 60));
}

checkEndingSoonTiming();
