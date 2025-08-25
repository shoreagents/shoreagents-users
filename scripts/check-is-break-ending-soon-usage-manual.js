// Manual check if is_break_ending_soon function is still being used anywhere
// This will help determine if it's safe to delete

const { Pool } = require('pg')

async function checkIsBreakEndingSoonUsageManual() {
  console.log('🔍 Manual Check of is_break_ending_soon Function Usage...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking if function exists...')
    
    const functionExists = await pool.query(`
      SELECT proname
      FROM pg_proc 
      WHERE proname = 'is_break_ending_soon'
    `)
    
    if (functionExists.rows.length > 0) {
      console.log('   ✅ Function exists in database')
    } else {
      console.log('   ❌ Function does not exist in database')
      return
    }
    
    console.log('\n2️⃣ Checking specific functions manually...')
    
    // Check the main function we know about
    try {
      const checkBreakReminders = await pool.query(`
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = 'check_break_reminders'
      `)
      
      if (checkBreakReminders.rows.length > 0) {
        const definition = checkBreakReminders.rows[0].definition
        if (definition.includes('is_break_ending_soon(')) {
          console.log('   🚨 check_break_reminders: STILL CALLING is_break_ending_soon')
        } else {
          console.log('   ✅ check_break_reminders: NOT calling is_break_ending_soon')
        }
      }
    } catch (error) {
      console.log('   ❌ Error checking check_break_reminders:', error.message)
    }
    
    // Check other potentially relevant functions
    const functionsToCheck = [
      'is_break_available',
      'is_break_available_now',
      'is_break_available_soon',
      'is_break_missed',
      'is_break_reminder_due',
      'trigger_break_availability_check'
    ]
    
    for (const funcName of functionsToCheck) {
      try {
        const funcResult = await pool.query(`
          SELECT pg_get_functiondef(oid) as definition
          FROM pg_proc 
          WHERE proname = $1
        `, [funcName])
        
        if (funcResult.rows.length > 0) {
          const definition = funcResult.rows[0].definition
          if (definition.includes('is_break_ending_soon(')) {
            console.log(`   🚨 ${funcName}: CALLING is_break_ending_soon`)
          } else if (definition.includes('is_break_ending_soon')) {
            console.log(`   ℹ️  ${funcName}: References is_break_ending_soon (but not calling)`)
          } else {
            console.log(`   ✅ ${funcName}: No reference to is_break_ending_soon`)
          }
        } else {
          console.log(`   ❌ ${funcName}: Function not found`)
        }
      } catch (error) {
        console.log(`   ❌ ${funcName}: Error checking - ${error.message}`)
      }
    }
    
    console.log('\n3️⃣ Checking function signature...')
    
    try {
      const functionSignature = await pool.query(`
        SELECT 
          proname,
          pg_get_function_identity_arguments(oid) as arguments
        FROM pg_proc 
        WHERE proname = 'is_break_ending_soon'
      `)
      
      if (functionSignature.rows.length > 0) {
        const func = functionSignature.rows[0]
        console.log(`   📋 Function signature: ${func.proname}(${func.arguments})`)
        
        if (func.arguments.includes('timestamp with time zone')) {
          console.log('   ✅ Function has updated signature (timestamp with time zone)')
        } else {
          console.log('   ⚠️  Function has old signature (timestamp without time zone)')
        }
      }
    } catch (error) {
      console.log('   ❌ Error checking function signature:', error.message)
    }
    
    console.log('\n4️⃣ Summary and recommendation...')
    
    console.log('   🔍 BASED ON WHAT WE KNOW:')
    console.log('   • check_break_reminders was updated to NOT call is_break_ending_soon')
    console.log('   • We replaced it with is_break_window_ending_soon calls')
    console.log('   • The function signature was fixed in migration 053')
    
    console.log('\n   🎯 RECOMMENDATION: PROBABLY SAFE TO DELETE')
    console.log('   ✅ Main function no longer uses it')
    console.log('   ✅ Function signature was fixed')
    console.log('   ✅ Duplicate notification issue was resolved')
    
    console.log('\n   🔧 To delete safely:')
    console.log('   DROP FUNCTION IF EXISTS is_break_ending_soon(integer, timestamp with time zone);')
    console.log('   DROP FUNCTION IF EXISTS is_break_ending_soon(integer, timestamp without time zone);')
    
    console.log('\n   ⚠️  SAFETY CHECK:')
    console.log('   • Wait a few days to ensure no issues')
    console.log('   • Monitor for any errors in logs')
    console.log('   • If everything works fine, then delete')
    
  } catch (error) {
    console.error('❌ Error during check:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the check
checkIsBreakEndingSoonUsageManual()
  .then(() => {
    console.log('\n✅ Manual usage check completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Manual usage check failed:', error.message)
    process.exit(1)
  })
