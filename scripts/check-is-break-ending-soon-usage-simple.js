// Simple check if is_break_ending_soon function is still being used anywhere
// This will help determine if it's safe to delete

const { Pool } = require('pg')

async function checkIsBreakEndingSoonUsageSimple() {
  console.log('🔍 Checking is_break_ending_soon Function Usage (Simple)...\n')
  
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
    
    console.log('\n2️⃣ Checking what calls this function...')
    
    // Find all functions that call is_break_ending_soon
    const callingFunctions = await pool.query(`
      SELECT proname
      FROM pg_proc 
      WHERE pg_get_functiondef(oid) LIKE '%is_break_ending_soon%'
      AND proname != 'is_break_ending_soon'
    `)
    
    if (callingFunctions.rows.length > 0) {
      console.log(`   🚨 Found ${callingFunctions.rows.length} functions that still call is_break_ending_soon:`)
      for (const func of callingFunctions.rows) {
        console.log(`     • ${func.proname}`)
      }
      
      console.log('\n   🔍 Checking specific usage patterns...')
      
      // Check each function individually for active calls
      for (const func of callingFunctions.rows) {
        try {
          const funcDetails = await pool.query(`
            SELECT pg_get_functiondef(oid) as definition
            FROM pg_proc 
            WHERE proname = $1
          `, [func.proname])
          
          if (funcDetails.rows.length > 0) {
            const definition = funcDetails.rows[0].definition
            
            if (definition.includes('is_break_ending_soon(')) {
              console.log(`     ⚠️  ${func.proname}: ACTIVELY CALLING - Needs updating!`)
            } else {
              console.log(`     ℹ️  ${func.proname}: Just references it (probably safe)`)
            }
          }
        } catch (error) {
          console.log(`     ❌ ${func.proname}: Error checking - ${error.message}`)
        }
      }
      
    } else {
      console.log('   ✅ No functions are calling is_break_ending_soon')
    }
    
    console.log('\n3️⃣ Checking for external references...')
    
    // Check if there are any triggers using it
    const externalReferences = await pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers 
      WHERE action_statement LIKE '%is_break_ending_soon%'
    `)
    
    if (externalReferences.rows.length > 0) {
      console.log(`   🚨 Found ${externalReferences.rows.length} triggers using is_break_ending_soon:`)
      for (const trigger of externalReferences.rows) {
        console.log(`     • ${trigger.trigger_name}`)
      }
    } else {
      console.log('   ✅ No triggers are using is_break_ending_soon')
    }
    
    console.log('\n4️⃣ Checking function signature...')
    
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
    
    console.log('\n5️⃣ Summary and recommendation...')
    
    if (callingFunctions.rows.length === 0 && externalReferences.rows.length === 0) {
      console.log('   🎯 RECOMMENDATION: SAFE TO DELETE')
      console.log('   ✅ No active usage found')
      console.log('   ✅ Function is no longer needed')
      console.log('   ✅ Deleting it will clean up the codebase')
      
      console.log('\n   🔧 To delete safely:')
      console.log('   DROP FUNCTION IF EXISTS is_break_ending_soon(integer, timestamp with time zone);')
      console.log('   DROP FUNCTION IF EXISTS is_break_ending_soon(integer, timestamp without time zone);')
      
    } else {
      console.log('   🚨 RECOMMENDATION: DO NOT DELETE YET')
      console.log('   ❌ Function is still being used')
      console.log('   🔧 Need to update calling functions first')
      
      console.log('\n   📋 Action plan:')
      console.log('   1. Update all calling functions to use is_break_window_ending_soon')
      console.log('   2. Test that everything works')
      console.log('   3. Then delete is_break_ending_soon')
    }
    
  } catch (error) {
    console.error('❌ Error during check:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the check
checkIsBreakEndingSoonUsageSimple()
  .then(() => {
    console.log('\n✅ Usage check completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Usage check failed:', error.message)
    process.exit(1)
  })
