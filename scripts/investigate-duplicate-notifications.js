// Comprehensive investigation of duplicate notification sources
// Since the database function is already fixed, let's find where duplicates are coming from

const { Pool } = require('pg')

async function investigateDuplicateNotifications() {
  console.log('🔍 Investigating Duplicate Notification Sources...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking all functions that might create notifications...')
    
    // Get all functions that might create break notifications
    const functionsResult = await pool.query(`
      SELECT proname, pg_get_functiondef(oid) as function_definition
      FROM pg_proc 
      WHERE pg_get_functiondef(oid) LIKE '%create_break_reminder_notification%'
      OR pg_get_functiondef(oid) LIKE '%ending_soon%'
      OR pg_get_functiondef(oid) LIKE '%notifications%'
      ORDER BY proname
    `)
    
    console.log(`   Found ${functionsResult.rows.length} functions that might create notifications:`)
    
    const notificationFunctions = []
    for (const row of functionsResult.rows) {
      const funcName = row.proname
      const funcDef = row.function_definition
      
      // Check what type of notifications each function creates
      const createsEndingSoon = funcDef.includes('ending_soon')
      const callsCreateNotification = funcDef.includes('create_break_reminder_notification')
      const hasBreakType = funcDef.includes('break_type')
      
      console.log(`   • ${funcName}:`)
      console.log(`     - Creates ending_soon: ${createsEndingSoon ? '✅ YES' : '❌ NO'}`)
      console.log(`     - Calls create_break_reminder_notification: ${callsCreateNotification ? '✅ YES' : '❌ NO'}`)
      console.log(`     - Has break_type parameter: ${hasBreakType ? '✅ YES' : '❌ NO'}`)
      
      if (createsEndingSoon && callsCreateNotification) {
        notificationFunctions.push({
          name: funcName,
          definition: funcDef,
          hasBreakType: hasBreakType
        })
      }
    }
    
    console.log('\n2️⃣ Analyzing notification creation functions...')
    
    for (const func of notificationFunctions) {
      console.log(`\n   🔍 Function: ${func.name}`)
      
      if (func.hasBreakType) {
        console.log(`     ✅ GOOD: Passes break_type parameter`)
      } else {
        console.log(`     ❌ PROBLEM: Missing break_type parameter - will create generic notifications!`)
      }
      
      // Check if this function is called by check_break_reminders
      if (func.definition.includes('is_break_window_ending_soon')) {
        console.log(`     ✅ GOOD: Uses is_break_window_ending_soon (specific notifications)`)
      } else if (func.definition.includes('is_break_ending_soon')) {
        console.log(`     ❌ PROBLEM: Uses is_break_ending_soon (generic notifications)`)
      }
    }
    
    console.log('\n3️⃣ Checking for other notification creation methods...')
    
    // Check if there are other ways notifications are created
    const otherMethodsResult = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      AND column_name IN ('category', 'type', 'title', 'message')
    `)
    
    console.log('   Notifications table structure:')
    for (const row of otherMethodsResult.rows) {
      console.log(`     • ${row.table_name}.${row.column_name}`)
    }
    
    console.log('\n4️⃣ Checking recent notifications for patterns...')
    
    // Look at recent notifications to see if there are patterns
    const recentNotificationsResult = await pool.query(`
      SELECT 
        id, 
        user_id, 
        category, 
        type, 
        title, 
        message, 
        payload,
        created_at
      FROM notifications 
      WHERE category = 'break' 
      AND title LIKE '%ending soon%'
      ORDER BY created_at DESC 
      LIMIT 10
    `)
    
    if (recentNotificationsResult.rows.length > 0) {
      console.log(`   Found ${recentNotificationsResult.rows.length} recent "ending soon" notifications:`)
      
      for (const notif of recentNotificationsResult.rows) {
        const payload = notif.payload ? JSON.parse(notif.payload) : {}
        console.log(`     • ID ${notif.id}: "${notif.title}" at ${notif.created_at}`)
        console.log(`       - User: ${notif.user_id}, Break Type: ${payload.break_type || 'NULL'}`)
        console.log(`       - Payload: ${JSON.stringify(payload)}`)
      }
    } else {
      console.log('   No recent "ending soon" notifications found')
    }
    
    console.log('\n5️⃣ Checking for scheduled jobs or triggers...')
    
    // Check if there are any scheduled jobs or triggers
    const triggersResult = await pool.query(`
      SELECT 
        trigger_name, 
        event_manipulation, 
        action_statement
      FROM information_schema.triggers 
      WHERE trigger_name LIKE '%break%' 
      OR trigger_name LIKE '%notification%'
    `)
    
    if (triggersResult.rows.length > 0) {
      console.log(`   Found ${triggersResult.rows.length} triggers that might affect notifications:`)
      for (const trigger of triggersResult.rows) {
        console.log(`     • ${trigger.trigger_name}: ${trigger.event_manipulation}`)
      }
    } else {
      console.log('   No relevant triggers found')
    }
    
    console.log('\n6️⃣ Summary of findings...')
    
    const problematicFunctions = notificationFunctions.filter(f => !f.hasBreakType)
    
    if (problematicFunctions.length > 0) {
      console.log('   🚨 PROBLEMS FOUND:')
      for (const func of problematicFunctions) {
        console.log(`     • ${func.name} - Missing break_type parameter`)
      }
      console.log('   🔧 These functions need to be updated to pass break_type')
    } else {
      console.log('   ✅ All notification functions look good')
    }
    
    if (recentNotificationsResult.rows.length > 0) {
      const genericNotifications = recentNotificationsResult.rows.filter(n => {
        const payload = n.payload ? JSON.parse(n.payload) : {}
        return !payload.break_type
      })
      
      if (genericNotifications.length > 0) {
        console.log(`   🚨 Found ${genericNotifications.length} generic notifications without break_type`)
        console.log('   🔧 These are likely coming from functions that need updating')
      } else {
        console.log('   ✅ All recent notifications have proper break_type values')
      }
    }
    
  } catch (error) {
    console.error('❌ Error during investigation:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the investigation
investigateDuplicateNotifications()
  .then(() => {
    console.log('\n✅ Investigation completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error.message)
    process.exit(1)
  })
