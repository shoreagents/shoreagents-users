const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function runMigration076Updated() {
  let pool = null
  try {
    console.log('🚀 Running Migration 076 Updated: Events Real-time Notifications with Database Notifications')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '076_events_realtime_notifications.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Execute the migration
      await client.query(migrationSQL)
      console.log('✅ Migration 076 Updated executed successfully')
      
      // Test the new functions
      console.log('🧪 Testing new functions...')
      
      // Test send_event_reminders function
      await client.query('SELECT send_event_reminders()')
      console.log('✅ send_event_reminders function works')
      
      // Check if triggers exist
      const triggerCheck = await client.query(`
        SELECT trigger_name, event_manipulation, action_timing
        FROM information_schema.triggers 
        WHERE trigger_name IN ('events_notify_trigger', 'event_attendance_notify_trigger')
      `)
      
      console.log('📋 Event triggers status:')
      triggerCheck.rows.forEach(row => {
        console.log(`  - ${row.trigger_name}: ${row.action_timing} ${row.event_manipulation}`)
      })
      
      // Check if functions exist
      const functionCheck = await client.query(`
        SELECT routine_name, routine_type
        FROM information_schema.routines 
        WHERE routine_name IN ('notify_event_change', 'notify_event_attendance_change', 'send_event_reminders')
        AND routine_schema = 'public'
      `)
      
      console.log('🔧 Event functions status:')
      functionCheck.rows.forEach(row => {
        console.log(`  - ${row.routine_name}: ${row.routine_type}`)
      })
      
      console.log('🎉 Migration 076 Updated completed successfully!')
      console.log('')
      console.log('📝 What was updated:')
      console.log('  - Removed toast notifications from use-events.ts')
      console.log('  - Added database notifications for event creation (upcoming only)')
      console.log('  - Added database notifications for event status changes (started, cancelled)')
      console.log('  - Added 15-minute reminder notifications via send_event_reminders()')
      console.log('  - No notifications for "ended" status')
      console.log('  - Updated notification service to handle event category')
      console.log('')
      console.log('⏰ To enable reminders, run the event-reminder-scheduler.js script periodically')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Error running Migration 076 Updated:', error)
    throw error
  } finally {
    if (pool) await pool.end()
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration076Updated()
    .then(() => {
      console.log('Migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

module.exports = { runMigration076Updated }
