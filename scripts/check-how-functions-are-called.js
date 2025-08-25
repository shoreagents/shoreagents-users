// Check how these functions are actually being called in the system
// This will help us understand why some notifications work despite signature issues

const { Pool } = require('pg')

async function checkHowFunctionsAreCalled() {
  console.log('🔍 Checking How Functions Are Actually Called...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking check_break_reminders function calls...')
    
    // Get the actual function definition to see how it calls these functions
    const checkBreakRemindersDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (checkBreakRemindersDef.rows.length > 0) {
      const definition = checkBreakRemindersDef.rows[0].definition
      console.log('   📝 Function definition preview:')
      console.log(`   ${definition.substring(0, 500)}...`)
      
      // Check specific function calls
      console.log('\n   🔍 Function calls found:')
      
      if (definition.includes('is_break_available_soon(')) {
        console.log('     ✅ is_break_available_soon() - called')
        // Extract the actual call to see parameters
        const match = definition.match(/is_break_available_soon\([^)]+\)/g)
        if (match) {
          console.log(`        Calls: ${match.join(', ')}`)
        }
      }
      
      if (definition.includes('is_break_available_now(')) {
        console.log('     ✅ is_break_available_now() - called')
        const match = definition.match(/is_break_available_now\([^)]+\)/g)
        if (match) {
          console.log(`        Calls: ${match.join(', ')}`)
        }
      }
      
      if (definition.includes('is_break_available_now_notification_sent(')) {
        console.log('     ✅ is_break_available_now_notification_sent() - called')
        const match = definition.match(/is_break_available_now_notification_sent\([^)]+\)/g)
        if (match) {
          console.log(`        Calls: ${match.join(', ')}`)
        }
      }
    }
    
    console.log('\n2️⃣ Testing actual function calls with different parameter types...')
    
    // Test if these functions work with timestamp without time zone
    const functionsToTest = [
      'is_break_available',
      'is_break_available_now', 
      'is_break_available_now_notification_sent'
    ]
    
    for (const funcName of functionsToTest) {
      console.log(`\n   🔍 Testing ${funcName}:`)
      
      try {
        // Test with timestamp without time zone (what the function expects)
        const result1 = await pool.query(`
          SELECT ${funcName}(2, 'Lunch'::break_type_enum, NOW()::timestamp) as result
        `)
        console.log(`     ✅ timestamp without time zone: ${result1.rows[0].result}`)
      } catch (error) {
        console.log(`     ❌ timestamp without time zone failed: ${error.message}`)
      }
      
      try {
        // Test with timestamp with time zone (what the system might be sending)
        const result2 = await pool.query(`
          SELECT ${funcName}(2, 'Lunch'::break_type_enum, NOW()) as result
        `)
        console.log(`     ✅ timestamp with time zone: ${result2.rows[0].result}`)
      } catch (error) {
        console.log(`     ❌ timestamp with time zone failed: ${error.message}`)
      }
      
      try {
        // Test with explicit cast to timestamp without time zone
        const result3 = await pool.query(`
          SELECT ${funcName}(2, 'Lunch'::break_type_enum, (NOW() AT TIME ZONE 'Asia/Manila')::timestamp) as result
        `)
        console.log(`     ✅ explicit timestamp cast: ${result3.rows[0].result}`)
      } catch (error) {
        console.log(`     ❌ explicit timestamp cast failed: ${error.message}`)
      }
    }
    
    console.log('\n3️⃣ Checking if there are multiple function versions...')
    
    // Check if there are multiple versions of these functions
    for (const funcName of functionsToTest) {
      const versions = await pool.query(`
        SELECT 
          proname,
          pg_get_function_identity_arguments(oid) as arguments,
          pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = $1
        ORDER BY arguments
      `, [funcName])
      
      if (versions.rows.length > 1) {
        console.log(`\n   🔍 ${funcName} has ${versions.rows.length} versions:`)
        for (const version of versions.rows) {
          console.log(`     • ${funcName}(${version.arguments})`)
        }
      } else if (versions.rows.length === 1) {
        console.log(`\n   ✅ ${funcName} has 1 version: ${funcName}(${versions.rows[0].arguments})`)
      } else {
        console.log(`\n   ❌ ${funcName} not found`)
      }
    }
    
    console.log('\n4️⃣ Summary and analysis...')
    
    console.log('   🔍 KEY FINDINGS:')
    console.log('   • If "available now" notifications work, the functions ARE being called')
    console.log('   • The system must be calling them with compatible parameter types')
    console.log('   • There might be implicit type casting happening')
    
    console.log('\n   🎯 POSSIBLE EXPLANATIONS:')
    console.log('   • PostgreSQL might be doing implicit type conversion')
    console.log('   • The calling code might be casting parameters before calling')
    console.log('   • There might be multiple function versions')
    console.log('   • The system might be using a different function entirely')
    
  } catch (error) {
    console.error('❌ Error during check:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the check
checkHowFunctionsAreCalled()
  .then(() => {
    console.log('\n✅ Function call analysis completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Function call analysis failed:', error.message)
    process.exit(1)
  })
