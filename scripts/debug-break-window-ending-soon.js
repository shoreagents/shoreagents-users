// Debug the is_break_window_ending_soon function
// This will help us understand why it's not triggering

const { Pool } = require('pg')

async function debugBreakWindowEndingSoon() {
  console.log('🔍 Debugging is_break_window_ending_soon Function...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Testing is_break_window_ending_soon at different times...')
    
    // Test at the time when notifications were created
    const testTimes = [
      '2025-08-25 12:45:00', // When "Break ending soon" was created
      '2025-08-25 12:58:00', // When "Lunch break ending soon" was created
      '2025-08-25 08:45:00'  // When morning "Break ending soon" was created
    ]
    
    for (const testTime of testTimes) {
      console.log(`\n   🔍 Testing at ${testTime}:`)
      
      try {
        // Test for Lunch break
        const lunchResult = await pool.query(`
          SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
        `, [testTime])
        
        console.log(`     • Lunch break ending soon: ${lunchResult.rows[0].result}`)
        
        // Test for Morning break
        const morningResult = await pool.query(`
          SELECT is_break_window_ending_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
        `, [testTime])
        
        console.log(`     • Morning break ending soon: ${morningResult.rows[0].result}`)
        
        // Test for Afternoon break
        const afternoonResult = await pool.query(`
          SELECT is_break_window_ending_soon(2, 'Afternoon'::break_type_enum, $1::timestamp) as result
        `, [testTime])
        
        console.log(`     • Afternoon break ending soon: ${afternoonResult.rows[0].result}`)
        
      } catch (error) {
        console.log(`     ❌ Error testing: ${error.message}`)
      }
    }
    
    console.log('\n2️⃣ Checking break windows calculation...')
    
    // Check what break windows are calculated for user 2
    try {
      const breakWindowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows(2)
        ORDER BY break_type
      `)
      
      if (breakWindowsResult.rows.length > 0) {
        console.log(`   Found ${breakWindowsResult.rows.length} break windows for user 2:`)
        for (const window of breakWindowsResult.rows) {
          console.log(`     • ${window.break_type}: ${window.start_time} - ${window.end_time}`)
        }
      } else {
        console.log('   ❌ No break windows found for user 2')
      }
    } catch (error) {
      console.log(`   ❌ Error calculating break windows: ${error.message}`)
    }
    
    console.log('\n3️⃣ Checking agent shift info...')
    
    // Check if user 2 has proper shift information
    try {
      const shiftInfoResult = await pool.query(`
        SELECT * FROM get_agent_shift_info(2)
      `)
      
      if (shiftInfoResult.rows.length > 0) {
        const shift = shiftInfoResult.rows[0]
        console.log(`   User 2 shift info:`)
        console.log(`     • Shift time: ${shift.shift_time}`)
        console.log(`     • Other fields: ${JSON.stringify(shift)}`)
      } else {
        console.log('   ❌ No shift info found for user 2')
      }
    } catch (error) {
      console.log(`   ❌ Error getting shift info: ${error.message}`)
    }
    
    console.log('\n4️⃣ Testing with current time...')
    
    // Test with current time to see if it works now
    try {
      const currentTime = new Date().toISOString()
      console.log(`   Current time: ${currentTime}`)
      
      const currentLunchResult = await pool.query(`
        SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, NOW()) as result
      `)
      
      console.log(`   • Lunch break ending soon (current time): ${currentLunchResult.rows[0].result}`)
      
    } catch (error) {
      console.log(`   ❌ Error testing current time: ${error.message}`)
    }
    
    console.log('\n5️⃣ Checking if break was already taken...')
    
    // Check if user 2 has already taken breaks today
    try {
      const breaksTakenResult = await pool.query(`
        SELECT break_type, start_time, end_time, break_date
        FROM break_sessions
        WHERE agent_user_id = 2
        AND break_date = CURRENT_DATE
        ORDER BY start_time
      `)
      
      if (breaksTakenResult.rows.length > 0) {
        console.log(`   User 2 has taken ${breaksTakenResult.rows.length} breaks today:`)
        for (const breakSession of breaksTakenResult.rows) {
          console.log(`     • ${breakSession.break_type}: ${breakSession.start_time} - ${breakSession.end_time || 'Active'}`)
        }
      } else {
        console.log('   User 2 has not taken any breaks today')
      }
    } catch (error) {
      console.log(`   ❌ Error checking break sessions: ${error.message}`)
    }
    
    console.log('\n6️⃣ Summary and diagnosis...')
    
    console.log('   🔍 DIAGNOSIS:')
    console.log('     • The function exists and can be called')
    console.log('     • But it\'s returning false when it should return true')
    console.log('     • This suggests a logic issue in the function itself')
    
    console.log('\n   🔧 POSSIBLE CAUSES:')
    console.log('     • Break windows not calculated correctly')
    console.log('     • Shift information missing or incorrect')
    console.log('     • Break already taken (function returns false)')
    console.log('     • Timezone calculation issues')
    console.log('     • Function logic bug')
    
  } catch (error) {
    console.error('❌ Error during debugging:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the debugging
debugBreakWindowEndingSoon()
  .then(() => {
    console.log('\n✅ Debugging completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Debugging failed:', error.message)
    process.exit(1)
  })
