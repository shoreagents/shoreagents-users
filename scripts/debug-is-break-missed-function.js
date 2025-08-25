// Debug the is_break_missed function to understand why it's not working for Afternoon breaks

const { Pool } = require('pg')

async function debugIsBreakMissedFunction() {
  console.log('🔍 Debugging is_break_missed Function for Afternoon Breaks...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking if is_break_missed function exists...')
    
    const functionExists = await pool.query(`
      SELECT 
        proname,
        pg_get_function_identity_arguments(oid) as arguments,
        pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'is_break_missed'
    `)
    
    if (functionExists.rows.length > 0) {
      const func = functionExists.rows[0]
      console.log(`   ✅ Function exists: ${func.proname}(${func.arguments})`)
      console.log(`   📝 Function definition preview: ${func.definition.substring(0, 200)}...`)
    } else {
      console.log('   ❌ Function not found')
      return
    }
    
    console.log('\n2️⃣ Testing is_break_missed at different times for Afternoon break...')
    
    // Test at the times when notifications should happen
    const testTimes = [
      '2025-08-25 13:45:00', // When "Afternoon break is now available" was sent
      '2025-08-25 14:15:00', // When "You have not taken your Afternoon break yet!" should be sent (30 min after)
      '2025-08-25 14:30:00', // When "Afternoon break ending soon" should be sent (15 min before end)
      '2025-08-25 14:45:00'  // When break window ends
    ]
    
    for (const testTime of testTimes) {
      console.log(`\n   🔍 Testing at ${testTime}:`)
      
      try {
        const result = await pool.query(`
          SELECT is_break_missed(2, 'Afternoon'::break_type_enum, $1::timestamp without time zone) as result
        `, [testTime])
        
        console.log(`     • is_break_missed result: ${result.rows[0].result}`)
        
        // Also test with timestamp with time zone to see if there are signature issues
        try {
          const resultTz = await pool.query(`
            SELECT is_break_missed(2, 'Afternoon'::break_type_enum, $1::timestamp with time zone) as result
          `, [testTime])
          console.log(`     • is_break_missed with timezone: ${resultTz.rows[0].result}`)
        } catch (error) {
          console.log(`     • is_break_missed with timezone: ❌ Error - ${error.message}`)
        }
        
      } catch (error) {
        console.log(`     ❌ Error testing: ${error.message}`)
      }
    }
    
    console.log('\n3️⃣ Checking if is_break_missed is called in check_break_reminders...')
    
    const checkBreakRemindersDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (checkBreakRemindersDef.rows.length > 0) {
      const definition = checkBreakRemindersDef.rows[0].definition
      
      if (definition.includes('is_break_missed(')) {
        console.log('   ✅ is_break_missed is called in check_break_reminders')
        
        // Extract the actual calls to see parameters
        const match = definition.match(/is_break_missed\([^)]+\)/g)
        if (match) {
          console.log(`   📝 Calls found: ${match.join(', ')}`)
        }
        
        // Check if it's called for Afternoon breaks specifically
        if (definition.includes("is_break_missed(agent_record.user_id, 'Afternoon'")) {
          console.log('   ✅ is_break_missed is called for Afternoon breaks')
        } else {
          console.log('   ❌ is_break_missed is NOT called for Afternoon breaks')
        }
        
      } else {
        console.log('   ❌ is_break_missed is NOT called in check_break_reminders')
      }
    }
    
    console.log('\n4️⃣ Testing the logic manually...')
    
    // Test the specific scenario: 30 minutes after break becomes available
    console.log('\n   🔍 Testing 30-minute missed break logic:')
    
    try {
      // Check if break was available at 1:45 PM
      const wasAvailable = await pool.query(`
        SELECT is_break_available_now(2, 'Afternoon'::break_type_enum, '2025-08-25 13:45:00'::timestamp without time zone) as result
      `)
      console.log(`     • Was Afternoon break available at 1:45 PM: ${wasAvailable.rows[0].result}`)
      
      // Check if break was taken by 2:15 PM
      const wasTaken = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM break_sessions
          WHERE agent_user_id = 2
          AND break_type = 'Afternoon'
          AND break_date = '2025-08-25'
          AND start_time <= '14:15:00'::time
          AND end_time IS NOT NULL
        ) as result
      `)
      console.log(`     • Was Afternoon break taken by 2:15 PM: ${wasTaken.rows[0].result}`)
      
      // Test is_break_missed at 2:15 PM
      const missedAt215 = await pool.query(`
        SELECT is_break_missed(2, 'Afternoon'::break_type_enum, '2025-08-25 14:15:00'::timestamp without time zone) as result
      `)
      console.log(`     • is_break_missed at 2:15 PM: ${missedAt215.rows[0].result}`)
      
    } catch (error) {
      console.log(`     ❌ Error testing logic: ${error.message}`)
    }
    
    console.log('\n5️⃣ Summary and diagnosis...')
    
    console.log('   🔍 DIAGNOSIS:')
    console.log('   • We need to see if is_break_missed is actually being called')
    console.log('   • We need to see if the function logic is working correctly')
    console.log('   • We need to see if the timing calculations are correct')
    
    console.log('\n   🎯 NEXT STEPS:')
    console.log('   • Check if is_break_missed is included in check_break_reminders')
    console.log('   • Verify the function logic for Afternoon breaks')
    console.log('   • Test the timing calculations')
    
  } catch (error) {
    console.error('❌ Error during debugging:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the debugging
debugIsBreakMissedFunction()
  .then(() => {
    console.log('\n✅ Debugging completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Debugging failed:', error.message)
    process.exit(1)
  })
