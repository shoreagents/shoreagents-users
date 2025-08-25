// Check the current state of the check_break_reminders function in the database
// This will show us what's actually being used vs what we think should be there

const { Pool } = require('pg')

async function checkCurrentDatabaseState() {
  console.log('🔍 Checking Current Database State...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking current check_break_reminders function...')
    
    // Get the current function definition
    const functionInfo = await pool.query(`
      SELECT pg_get_functiondef(oid) as function_definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (functionInfo.rows.length === 0) {
      console.log('   ❌ Function check_break_reminders not found in database!')
      return
    }
    
    const functionDef = functionInfo.rows[0].function_definition
    console.log('   ✅ Function found in database')
    
    console.log('\n2️⃣ Analyzing function content...')
    
    // Check for key components
    const hasBreakEndingSoon = functionDef.includes('is_break_ending_soon')
    const hasBreakWindowEndingSoon = functionDef.includes('is_break_window_ending_soon')
    const hasBreakTypeParameter = functionDef.includes('ending_soon\', \'Morning\'')
    
    console.log(`   • Calls is_break_ending_soon: ${hasBreakEndingSoon ? '❌ YES (This is the problem!)' : '✅ NO'}`)
    console.log(`   • Calls is_break_window_ending_soon: ${hasBreakWindowEndingSoon ? '✅ YES' : '❌ NO (Missing!)'}`)
    console.log(`   • Passes break_type parameter: ${hasBreakTypeParameter ? '✅ YES' : '❌ NO (Generic notifications!)'}`)
    
    console.log('\n3️⃣ Current function behavior:')
    
    if (hasBreakEndingSoon && !hasBreakWindowEndingSoon) {
      console.log('   🚨 PROBLEM: Function is using OLD logic (is_break_ending_soon)')
      console.log('   🚨 This creates generic "Break ending soon" notifications')
      console.log('   🚨 Missing: Break window ending soon checks')
    } else if (hasBreakWindowEndingSoon && !hasBreakEndingSoon) {
      console.log('   ✅ GOOD: Function is using NEW logic (is_break_window_ending_soon)')
      console.log('   ✅ This creates specific "Lunch break ending soon" notifications')
    } else if (hasBreakEndingSoon && hasBreakWindowEndingSoon) {
      console.log('   ⚠️  WARNING: Function has BOTH old and new logic')
      console.log('   ⚠️  This will create duplicate notifications!')
    } else {
      console.log('   ❓ UNKNOWN: Function structure unclear')
    }
    
    console.log('\n4️⃣ What needs to be done:')
    
    if (hasBreakEndingSoon) {
      console.log('   🔧 Need to apply Migration 052 to replace this function')
      console.log('   🔧 This will remove is_break_ending_soon calls')
      console.log('   🔧 And add is_break_window_ending_soon checks')
    } else {
      console.log('   ✅ Function is already updated correctly')
    }
    
    console.log('\n5️⃣ Testing current function...')
    
    try {
      const testResult = await pool.query('SELECT check_break_reminders() as notifications_sent')
      const notificationsSent = testResult.rows[0].notifications_sent
      console.log(`   ✅ Function executed successfully: ${notificationsSent} notifications sent`)
    } catch (error) {
      console.log(`   ❌ Function execution failed: ${error.message}`)
    }
    
  } catch (error) {
    console.error('❌ Error checking database state:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the check
checkCurrentDatabaseState()
  .then(() => {
    console.log('\n✅ Database state check completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error.message)
    process.exit(1)
  })
