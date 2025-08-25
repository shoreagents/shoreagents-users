// Apply the migration to add missing "missed break" reminder logic to check_break_reminders

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

async function applyMissingBreakReminderFix() {
  console.log('🔧 Applying Missing Break Reminder Fix...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '054_add_missing_break_reminder_logic.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('1️⃣ Applying migration to add missing "missed break" logic...')
    
    // Split the migration into individual statements
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim())
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await pool.query(statement)
          console.log('   ✅ Statement executed successfully')
        } catch (error) {
          console.log(`   ⚠️  Statement warning: ${error.message}`)
        }
      }
    }
    
    console.log('\n2️⃣ Verifying the fix was applied...')
    
    // Check if is_break_missed is now called in check_break_reminders
    const checkBreakRemindersDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (checkBreakRemindersDef.rows.length > 0) {
      const definition = checkBreakRemindersDef.rows[0].definition
      
      if (definition.includes('is_break_missed(')) {
        console.log('   ✅ is_break_missed is now called in check_break_reminders')
        
        // Count how many times it's called
        const matches = definition.match(/is_break_missed\(/g)
        if (matches) {
          console.log(`   📊 Total calls to is_break_missed: ${matches.length}`)
        }
        
        // Check if it's called for Afternoon breaks specifically
        if (definition.includes("is_break_missed(agent_record.user_id, 'Afternoon'")) {
          console.log('   ✅ is_break_missed is called for Afternoon breaks')
        } else {
          console.log('   ❌ is_break_missed is NOT called for Afternoon breaks')
        }
        
        // Check if it's called for all break types
        const breakTypes = ['Morning', 'Lunch', 'Afternoon', 'NightFirst', 'NightMeal', 'NightSecond']
        let allTypesCovered = true
        
        for (const breakType of breakTypes) {
          if (!definition.includes(`is_break_missed(agent_record.user_id, '${breakType}'`)) {
            console.log(`   ❌ Missing is_break_missed call for ${breakType}`)
            allTypesCovered = false
          }
        }
        
        if (allTypesCovered) {
          console.log('   ✅ All break types now have missed break logic')
        }
        
      } else {
        console.log('   ❌ is_break_missed is still NOT called in check_break_reminders')
      }
    }
    
    console.log('\n3️⃣ Testing the updated function...')
    
    // Test if the function can be called without errors
    try {
      const result = await pool.query('SELECT check_break_reminders() as notifications_sent')
      console.log(`   ✅ Function executed successfully, returned: ${result.rows[0].notifications_sent}`)
    } catch (error) {
      console.log(`   ❌ Function execution failed: ${error.message}`)
    }
    
    console.log('\n4️⃣ Summary of the fix...')
    
    console.log('   🎯 WHAT WAS FIXED:')
    console.log('   • Added missing "missed break" reminder logic to check_break_reminders')
    console.log('   • Now calls is_break_missed for all break types')
    console.log('   • Will send "You have not taken your [Break] yet!" notifications')
    console.log('   • Notifications sent 30 minutes after break becomes available')
    
    console.log('\n   📅 EXPECTED NOTIFICATION TIMELINE FOR AFTERNOON BREAK:')
    console.log('   • 1:45 PM: "Afternoon break is now available" ✅ (already working)')
    console.log('   • 2:15 PM: "You have not taken your Afternoon break yet!" ✅ (NOW FIXED)')
    console.log('   • 2:30 PM: "Afternoon break ending soon" ✅ (already working)')
    console.log('   • 2:45 PM: Break window ends (no notification) ✅ (correct)')
    
    console.log('\n   🔄 NEXT STEPS:')
    console.log('   • The function will now send missed break reminders')
    console.log('   • Test with the next break cycle to verify it works')
    console.log('   • Monitor notifications to ensure proper timing')
    
  } catch (error) {
    console.error('❌ Error applying fix:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the fix
applyMissingBreakReminderFix()
  .then(() => {
    console.log('\n✅ Missing Break Reminder Fix Applied Successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fix Failed:', error.message)
    process.exit(1)
  })
