// Simple investigation of duplicate notification sources
// Since the database function is already fixed, let's find where duplicates are coming from

const { Pool } = require('pg')

async function investigateDuplicateNotificationsSimple() {
  console.log('🔍 Simple Investigation of Duplicate Notification Sources...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking recent notifications for patterns...')
    
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
        let payload = {}
        try {
          payload = notif.payload ? JSON.parse(notif.payload) : {}
        } catch (e) {
          payload = {}
        }
        
        console.log(`     • ID ${notif.id}: "${notif.title}" at ${notif.created_at}`)
        console.log(`       - User: ${notif.user_id}, Break Type: ${payload.break_type || 'NULL'}`)
        console.log(`       - Payload: ${JSON.stringify(payload)}`)
      }
      
      // Check for generic vs specific notifications
      const genericNotifications = recentNotificationsResult.rows.filter(n => {
        let payload = {}
        try {
          payload = n.payload ? JSON.parse(n.payload) : {}
        } catch (e) {
          payload = {}
        }
        return !payload.break_type
      })
      
      const specificNotifications = recentNotificationsResult.rows.filter(n => {
        let payload = {}
        try {
          payload = n.payload ? JSON.parse(n.payload) : {}
        } catch (e) {
          payload = {}
        }
        return payload.break_type
      })
      
      console.log(`\n   📊 Analysis:`)
      console.log(`     • Generic notifications (no break_type): ${genericNotifications.length}`)
      console.log(`     • Specific notifications (with break_type): ${specificNotifications.length}`)
      
      if (genericNotifications.length > 0) {
        console.log(`\n   🚨 PROBLEM: Found ${genericNotifications.length} generic notifications!`)
        console.log(`   🔍 These are likely coming from functions that need updating`)
        
        for (const notif of genericNotifications) {
          console.log(`     • "${notif.title}" - Missing break_type in payload`)
        }
      } else {
        console.log(`\n   ✅ All recent notifications have proper break_type values`)
      }
      
    } else {
      console.log('   No recent "ending soon" notifications found')
    }
    
    console.log('\n2️⃣ Checking for other notification creation methods...')
    
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
    
    console.log('\n3️⃣ Checking for scheduled jobs or triggers...')
    
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
    
    console.log('\n4️⃣ Checking for functions that might create notifications...')
    
    // Get a list of functions that might be relevant
    const functionsResult = await pool.query(`
      SELECT proname
      FROM pg_proc 
      WHERE proname LIKE '%break%' 
      OR proname LIKE '%notification%'
      OR proname LIKE '%reminder%'
      ORDER BY proname
    `)
    
    console.log(`   Found ${functionsResult.rows.length} potentially relevant functions:`)
    for (const row of functionsResult.rows) {
      console.log(`     • ${row.proname}`)
    }
    
    console.log('\n5️⃣ Summary and recommendations...')
    
    if (recentNotificationsResult.rows.length > 0) {
      const genericCount = recentNotificationsResult.rows.filter(n => {
        let payload = {}
        try {
          payload = n.payload ? JSON.parse(n.payload) : {}
        } catch (e) {
          payload = {}
        }
        return !payload.break_type
      }).length
      
      if (genericCount > 0) {
        console.log(`   🚨 PROBLEMS FOUND:`)
        console.log(`     • ${genericCount} generic notifications without break_type`)
        console.log(`     • These are likely coming from functions that need updating`)
        console.log(`\n   🔧 RECOMMENDATIONS:`)
        console.log(`     • Check if other functions besides check_break_reminders are running`)
        console.log(`     • Look for scheduled jobs or cron tasks that might call old functions`)
        console.log(`     • Check if there are multiple instances of the notification system running`)
      } else {
        console.log(`   ✅ All recent notifications look good`)
        console.log(`   🔍 If you're still getting duplicates, check:`)
        console.log(`     • Frontend caching`)
        console.log(`     • Multiple notification systems`)
        console.log(`     • Scheduled jobs outside the database`)
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
investigateDuplicateNotificationsSimple()
  .then(() => {
    console.log('\n✅ Investigation completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error.message)
    process.exit(1)
  })
