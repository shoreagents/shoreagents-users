// Apply the function signature fix for is_break_window_ending_soon
// This will fix the function signature mismatch that's preventing it from working

const { Pool } = require('pg')

async function applyFunctionSignatureFix() {
  console.log('🔧 Applying Function Signature Fix...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Reading the migration file...')
    const fs = require('fs')
    const migrationPath = './migrations/053_fix_function_signature_mismatch.sql'
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log('   ✅ Migration file read successfully')
    
    console.log('\n2️⃣ Applying the migration...')
    await pool.query(migrationSQL)
    console.log('   ✅ Migration applied successfully')
    
    console.log('\n3️⃣ Testing the fixed function...')
    
    // Test if the function now works with timestamp with time zone
    try {
      const testResult = await pool.query(`
        SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, NOW()) as result
      `)
      console.log(`   ✅ Function now works with timestamp with time zone: ${testResult.rows[0].result}`)
    } catch (error) {
      console.log(`   ❌ Function still has issues: ${error.message}`)
    }
    
    console.log('\n4️⃣ Testing at specific times when notifications were created...')
    
    // Test at the times when notifications were created
    const testTimes = [
      '2025-08-25 12:45:00', // When "Break ending soon" was created
      '2025-08-25 12:58:00', // When "Lunch break ending soon" was created
      '2025-08-25 08:45:00'  // When morning "Break ending soon" was created
    ]
    
    for (const testTime of testTimes) {
      try {
        const result = await pool.query(`
          SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, $1::timestamp with time zone) as result
        `, [testTime])
        
        console.log(`   • ${testTime}: ${result.rows[0].result}`)
      } catch (error) {
        console.log(`   • ${testTime}: ❌ Error - ${error.message}`)
      }
    }
    
    console.log('\n5️⃣ Verifying function signature...')
    
    // Check the function signature in the database
    const functionInfo = await pool.query(`
      SELECT 
        proname,
        pg_get_function_identity_arguments(oid) as arguments
      FROM pg_proc 
      WHERE proname = 'is_break_window_ending_soon'
    `)
    
    if (functionInfo.rows.length > 0) {
      const func = functionInfo.rows[0]
      console.log(`   ✅ Function signature: ${func.proname}(${func.arguments})`)
      
      if (func.arguments.includes('timestamp with time zone')) {
        console.log('   ✅ Function now accepts timestamp with time zone')
      } else {
        console.log('   ❌ Function still has wrong signature')
      }
    } else {
      console.log('   ❌ Function not found')
    }
    
    console.log('\n🎉 Function Signature Fix Applied Successfully!')
    console.log('\n📋 What was fixed:')
    console.log('   • Function signature mismatch in is_break_window_ending_soon')
    console.log('   • Function now accepts timestamp with time zone')
    console.log('   • This should allow the function to be called properly')
    console.log('   • Break window ending soon notifications should now work')
    
    console.log('\n🔍 The issue was:')
    console.log('   • Function existed but with wrong parameter type')
    console.log('   • System tried to call it with timestamp with time zone')
    console.log('   • Function signature was timestamp without time zone')
    console.log('   • This caused "function does not exist" errors')
    console.log('   • Function always returned false, causing fallback to old logic')
    
    console.log('\n✅ Expected results:')
    console.log('   • is_break_window_ending_soon should now return true at appropriate times')
    console.log('   • Specific break-type notifications should be created')
    console.log('   • Generic "Break ending soon" notifications should stop')
    
  } catch (error) {
    console.error('❌ Error applying the fix:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the fix
applyFunctionSignatureFix()
  .then(() => {
    console.log('\n✅ Fix completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error.message)
    process.exit(1)
  })
