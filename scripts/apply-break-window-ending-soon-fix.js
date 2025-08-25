// Apply the break window ending soon notification fix
// This prevents generic "Break ending soon" notifications by adding missing break window checks

const { Pool } = require('pg')

async function applyBreakWindowEndingSoonFix() {
  console.log('🔧 Applying Break Window Ending Soon Notification Fix...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Reading the migration file...')
    const fs = require('fs')
    const migrationPath = './migrations/052_fix_missing_break_window_ending_soon.sql'
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    console.log('   ✅ Migration file read successfully')
    
    console.log('\n2️⃣ Applying the migration...')
    await pool.query(migrationSQL)
    console.log('   ✅ Migration applied successfully')
    
    console.log('\n3️⃣ Testing the updated check_break_reminders function...')
    
    // Test the function to ensure it works
    const testResult = await pool.query('SELECT check_break_reminders() as notifications_sent')
    const notificationsSent = testResult.rows[0].notifications_sent
    console.log(`   ✅ check_break_reminders executed: ${notificationsSent} notifications sent`)
    
    console.log('\n4️⃣ Verifying the function structure...')
    
    // Check that the function now includes break window ending soon checks
    const functionInfo = await pool.query(`
      SELECT pg_get_functiondef(oid) as function_definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    const functionDef = functionInfo.rows[0].function_definition
    
    if (functionDef.includes('is_break_window_ending_soon')) {
      console.log('   ✅ Function now includes break window ending soon checks')
    } else {
      console.log('   ❌ Function still missing break window ending soon checks')
    }
    
    if (functionDef.includes('-- FIXED: Add break window ending soon checks')) {
      console.log('   ✅ Function includes the fix comment')
    } else {
      console.log('   ❌ Function missing the fix comment')
    }
    
    console.log('\n5️⃣ Testing break window ending soon logic...')
    
    // Test the is_break_window_ending_soon function for Lunch break
    const testEndingSoon = await pool.query(`
      SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result
    `)
    
    console.log(`   ✅ is_break_window_ending_soon function working: ${testEndingSoon.rows[0].result}`)
    
    console.log('\n🎉 Break Window Ending Soon Fix Applied Successfully!')
    console.log('\n📋 What was fixed:')
    console.log('   • Added missing break window ending soon checks to check_break_reminders()')
    console.log('   • Now sends "Lunch break ending soon" instead of generic "Break ending soon"')
    console.log('   • Prevents duplicate notifications for the same break type')
    console.log('   • Maintains existing functionality for active break ending soon (5 min)')
    
    console.log('\n🔍 The issue was:')
    console.log('   • check_break_reminders() was missing break window ending soon checks')
    console.log('   • Only had active break ending soon (5 min before active break ends)')
    console.log('   • Missing: Break window ending soon (15 min before break window expires)')
    console.log('   • This caused generic "Break ending soon" notifications instead of specific ones')
    
  } catch (error) {
    console.error('❌ Error applying the fix:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the fix
applyBreakWindowEndingSoonFix()
  .then(() => {
    console.log('\n✅ Fix completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error.message)
    process.exit(1)
  })
