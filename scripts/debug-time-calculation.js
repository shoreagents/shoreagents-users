const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugTimeCalculation() {
  try {
    console.log('🔍 Debugging Time Calculation Logic...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check current time and what should happen
    console.log('1️⃣ Current time analysis:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`   Current hour: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    // 2. Check break windows calculation
    console.log('\n2️⃣ Break windows calculation:');
    try {
      const breakWindowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows('6:00 AM - 3:00 PM')
      `);
      
      console.log('   Break windows for 6:00 AM - 3:00 PM shift:');
      console.log(`     Morning: ${breakWindowsResult.rows[0].morning_start} - ${breakWindowsResult.rows[0].morning_end}`);
      console.log(`     Lunch: ${breakWindowsResult.rows[0].lunch_start} - ${breakWindowsResult.rows[0].lunch_end}`);
      console.log(`     Afternoon: ${breakWindowsResult.rows[0].afternoon_start} - ${breakWindowsResult.rows[0].afternoon_end}`);
      
      const lunchStart = breakWindowsResult.rows[0].lunch_start;
      const lunchEnd = breakWindowsResult.rows[0].lunch_end;
      
      console.log('\n   Expected behavior:');
      console.log(`     • Lunch break should be "available" from ${lunchStart} to ${lunchEnd}`);
      console.log(`     • "Available now" should only trigger at ${lunchStart} (10:00 AM)`);
      console.log(`     • After ${lunchStart}, it should show as "missed" every 30 minutes`);
      console.log(`     • At ${lunchEnd} (1:00 PM), lunch break window closes`);
      
    } catch (error) {
      console.log(`   ❌ Break windows error: ${error.message}`);
    }
    
    // 3. Test the is_break_available function at different times
    console.log('\n3️⃣ Testing is_break_available at different times:');
    
    const testTimes = [
      '2025-08-19 09:45:00', // 9:45 AM - should be available soon
      '2025-08-19 10:00:00', // 10:00 AM - should be available now
      '2025-08-19 10:30:00', // 10:30 AM - should NOT be available now (should be missed)
      '2025-08-19 11:00:00', // 11:00 AM - should NOT be available now (should be missed)
      '2025-08-19 11:30:00', // 11:30 AM - should NOT be available now (should be missed)
      '2025-08-19 12:00:00', // 12:00 PM - should NOT be available now (should be missed)
      '2025-08-19 12:30:00', // 12:30 PM - should NOT be available now (should be missed)
      '2025-08-19 12:35:00', // 12:35 PM - should NOT be available now (should be missed)
      '2025-08-19 13:00:00', // 1:00 PM - break window ends
      '2025-08-19 13:30:00', // 1:30 PM - definitely not available
    ];
    
    for (const testTime of testTimes) {
      try {
        const result = await pool.query(`
          SELECT 
            is_break_available($1, 'Lunch', $2::timestamp without time zone) as lunch_available
        `, [testAgentId, testTime]);
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        const isAvailable = result.rows[0].lunch_available;
        const expectedBehavior = timeLabel === '10:00:00' ? '✅ Should be available' : '❌ Should NOT be available';
        
        console.log(`   ${timeLabel}: ${isAvailable ? '✅ AVAILABLE' : '❌ Not available'} - ${expectedBehavior}`);
        
        // Highlight the problematic time
        if (timeLabel === '12:35:00' && isAvailable) {
          console.log(`   🚨 PROBLEM: Lunch is showing as available at 12:35 PM when it should NOT be!`);
        }
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 4. Check the current is_break_available function logic
    console.log('\n4️⃣ Current function logic analysis:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_available'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function logic:');
      
      // Look for the problematic logic
      if (source.includes('current_time_only >= break_start_time AND current_time_only <= break_end_time')) {
        console.log('   🚨 PROBLEM FOUND: Function returns true for entire break window!');
        console.log('   This is wrong - it should only return true at the START of the break');
        console.log('   ');
        console.log('   Current logic:');
        console.log('     IF current_time >= lunch_start AND current_time <= lunch_end THEN');
        console.log('       RETURN TRUE; -- This is wrong!');
        console.log('     END IF;');
        console.log('   ');
        console.log('   Should be:');
        console.log('     IF current_time = lunch_start THEN');
        console.log('       RETURN TRUE; -- Only at start time');
        console.log('     END IF;');
      }
    }
    
    // 5. Check frontend logic
    console.log('\n5️⃣ Frontend vs Backend comparison:');
    console.log('   Backend (current): Returns true for entire break window (10 AM - 1 PM) ❌');
    console.log('   Frontend (expected): Should only show "available" at start time (10 AM) ✅');
    console.log('   ');
    console.log('   The backend logic is too permissive - it treats the entire break window');
    console.log('   as "available" instead of just the start time.');
    
    console.log('\n✅ Time calculation debug completed!');
    
  } catch (error) {
    console.error('❌ Error in time calculation debug:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugTimeCalculation();
