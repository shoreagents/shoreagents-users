// Check if the 3 functions have the same timestamp signature issues
// This will help identify if we need to fix more functions

const { Pool } = require('pg')

async function checkTimestampSignatureIssues() {
  console.log('🔍 Checking Timestamp Signature Issues in Break Functions...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking function signatures...')
    
    const functionsToCheck = [
      'is_break_available',
      'is_break_available_now', 
      'is_break_available_now_notification_sent'
    ]
    
    for (const funcName of functionsToCheck) {
      try {
        const funcResult = await pool.query(`
          SELECT 
            proname,
            pg_get_function_identity_arguments(oid) as arguments
          FROM pg_proc 
          WHERE proname = $1
        `, [funcName])
        
        if (funcResult.rows.length > 0) {
          const func = funcResult.rows[0]
          console.log(`\n   🔍 ${func.proname}:`)
          console.log(`     📋 Signature: ${func.proname}(${func.arguments})`)
          
          if (func.arguments.includes('timestamp with time zone')) {
            console.log(`     ✅ GOOD: Accepts timestamp with time zone`)
          } else if (func.arguments.includes('timestamp without time zone')) {
            console.log(`     ❌ PROBLEM: Only accepts timestamp without time zone`)
          } else if (func.arguments.includes('timestamp')) {
            console.log(`     ⚠️  WARNING: Generic timestamp (could be either)`)
          }
        } else {
          console.log(`\n   ❌ ${funcName}: Function not found`)
        }
      } catch (error) {
        console.log(`\n   ❌ ${funcName}: Error checking - ${error.message}`)
      }
    }
    
    console.log('\n2️⃣ Testing function calls with timestamp with time zone...')
    
    // Test if these functions can be called with timestamp with time zone
    for (const funcName of functionsToCheck) {
      try {
        console.log(`\n   🔍 Testing ${funcName}:`)
        
        if (funcName === 'is_break_available') {
          const result = await pool.query(`
            SELECT ${funcName}(2, 'Lunch'::break_type_enum, NOW()) as result
          `)
          console.log(`     ✅ Function call successful: ${result.rows[0].result}`)
        } else if (funcName === 'is_break_available_now') {
          const result = await pool.query(`
            SELECT ${funcName}(2, 'Lunch'::break_type_enum, NOW()) as result
          `)
          console.log(`     ✅ Function call successful: ${result.rows[0].result}`)
        } else if (funcName === 'is_break_available_now_notification_sent') {
          const result = await pool.query(`
            SELECT ${funcName}(2, 'Lunch'::break_type_enum, NOW()) as result
          `)
          console.log(`     ✅ Function call successful: ${result.rows[0].result}`)
        }
        
      } catch (error) {
        console.log(`     ❌ Function call failed: ${error.message}`)
        
        // Check if it's a signature mismatch error
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log(`     🚨 SIGNATURE MISMATCH: Function exists but wrong parameter types`)
        }
      }
    }
    
    console.log('\n3️⃣ Summary and recommendations...')
    
    console.log('   🔍 ANALYSIS:')
    console.log('   • These 3 functions are actively used in check_break_reminders')
    console.log('   • They handle "available soon" and "available now" notifications')
    console.log('   • If they have signature issues, notifications won\'t work properly')
    
    console.log('\n   🎯 RECOMMENDATIONS:')
    console.log('   • If any function calls failed, they need signature fixes')
    console.log('   • Update them to accept timestamp with time zone')
    console.log('   • This ensures all break notification functions work consistently')
    
  } catch (error) {
    console.error('❌ Error during check:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the check
checkTimestampSignatureIssues()
  .then(() => {
    console.log('\n✅ Timestamp signature check completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Timestamp signature check failed:', error.message)
    process.exit(1)
  })
