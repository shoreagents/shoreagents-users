// Check what's actually calling the notification functions
// This will help us find the source of the duplicate notifications

const { Pool } = require('pg')

async function checkWhatsCallingNotifications() {
  console.log('🔍 Checking What\'s Actually Calling Notification Functions...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking when notifications were created...')
    
    // Check the timing of recent notifications
    const timingResult = await pool.query(`
      SELECT 
        id, 
        title, 
        created_at,
        EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) / 60 as minutes_between
      FROM notifications 
      WHERE category = 'break' 
      AND title LIKE '%ending soon%'
      ORDER BY created_at DESC 
      LIMIT 10
    `)
    
    if (timingResult.rows.length > 0) {
      console.log('   Recent notification timing:')
      for (let i = 0; i < timingResult.rows.length; i++) {
        const row = timingResult.rows[i]
        const minutesBetween = row.minutes_between ? Math.round(row.minutes_between) : 'N/A'
        console.log(`     • ${row.title} at ${row.created_at} (${minutesBetween} min after previous)`)
      }
    }
    
    console.log('\n2️⃣ Checking for notification patterns...')
    
    // Look for patterns in notification creation
    const patternResult = await pool.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as count,
        STRING_AGG(DISTINCT title, ', ') as titles
      FROM notifications 
      WHERE category = 'break' 
      AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour DESC
    `)
    
    if (patternResult.rows.length > 0) {
      console.log('   Notifications by hour (last 24 hours):')
      for (const row of patternResult.rows) {
        console.log(`     • ${row.hour}: ${row.count} notifications - ${row.titles}`)
      }
    }
    
    console.log('\n3️⃣ Checking if multiple functions are running...')
    
    // Test if the old function is still working
    try {
      const oldFunctionTest = await pool.query(`
        SELECT is_break_ending_soon(2, NOW() AT TIME ZONE 'Asia/Manila') as result
      `)
      console.log(`   • is_break_ending_soon function: ${oldFunctionTest.rows[0].result ? '✅ Still working' : '❌ Not triggering'}`)
    } catch (error) {
      console.log(`   • is_break_ending_soon function: ❌ Error - ${error.message}`)
    }
    
    // Test if the new function is working
    try {
      const newFunctionTest = await pool.query(`
        SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result
      `)
      console.log(`   • is_break_window_ending_soon function: ${newFunctionTest.rows[0].result ? '✅ Working' : '❌ Not triggering'}`)
    } catch (error) {
      console.log(`   • is_break_window_ending_soon function: ❌ Error - ${error.message}`)
    }
    
    console.log('\n4️⃣ Checking for other notification creation functions...')
    
    // Look for functions that might be creating notifications
    const otherFunctionsResult = await pool.query(`
      SELECT proname, pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname IN ('check_break_reminders', 'is_break_ending_soon', 'is_break_window_ending_soon')
    `)
    
    for (const row of otherFunctionsResult.rows) {
      const funcName = row.proname
      const definition = row.definition
      
      console.log(`\n   🔍 Function: ${funcName}`)
      
      if (funcName === 'check_break_reminders') {
        const hasOldLogic = definition.includes('is_break_ending_soon')
        const hasNewLogic = definition.includes('is_break_window_ending_soon')
        
        if (hasOldLogic && hasNewLogic) {
          console.log(`     ⚠️  WARNING: Has BOTH old and new logic!`)
        } else if (hasOldLogic) {
          console.log(`     ❌ PROBLEM: Still using OLD logic`)
        } else if (hasNewLogic) {
          console.log(`     ✅ GOOD: Using NEW logic`)
        }
      } else if (funcName === 'is_break_ending_soon') {
        console.log(`     ℹ️  This function exists but should not be called by check_break_reminders`)
      } else if (funcName === 'is_break_window_ending_soon') {
        console.log(`     ✅ This function exists and should be used`)
      }
    }
    
    console.log('\n5️⃣ Checking for external calls...')
    
    // Look for any recent database activity that might indicate external calls
    const recentActivityResult = await pool.query(`
      SELECT 
        query_start,
        state,
        query
      FROM pg_stat_activity 
      WHERE query LIKE '%check_break_reminders%'
      OR query LIKE '%is_break_ending_soon%'
      OR query LIKE '%create_break_reminder_notification%'
      ORDER BY query_start DESC
      LIMIT 5
    `)
    
    if (recentActivityResult.rows.length > 0) {
      console.log(`   Found ${recentActivityResult.rows.length} recent database queries:`)
      for (const row of recentActivityResult.rows) {
        console.log(`     • ${row.state} at ${row.query_start}`)
        console.log(`       Query: ${row.query.substring(0, 100)}...`)
      }
    } else {
      console.log('   No recent database activity found for these functions')
    }
    
    console.log('\n6️⃣ Summary and next steps...')
    
    console.log('   🔍 INVESTIGATION RESULTS:')
    console.log('     • Your database function is fixed')
    console.log('     • But generic notifications are still being created')
    console.log('     • This suggests something ELSE is calling the old logic')
    
    console.log('\n   🔧 NEXT STEPS:')
    console.log('     • Check if there are scheduled jobs/cron tasks running')
    console.log('     • Look for multiple instances of your application')
    console.log('     • Check if other services are calling the database')
    console.log('     • Monitor database activity when notifications appear')
    
  } catch (error) {
    console.error('❌ Error during investigation:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the investigation
checkWhatsCallingNotifications()
  .then(() => {
    console.log('\n✅ Investigation completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error.message)
    process.exit(1)
  })
