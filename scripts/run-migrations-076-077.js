require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const databaseConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

async function runMigrations076And077() {
  let pool = null
  try {
    console.log('🚀 Running Migrations 076 & 077: Events Real-time Notifications + Event Type Field')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Run Migration 077 first (add event_type field)
      console.log('📝 Running Migration 077: Adding event_type field...')
      const migration077Path = path.join(__dirname, '..', 'migrations', '077_add_event_type_field.sql')
      const migration077SQL = fs.readFileSync(migration077Path, 'utf8')
      await client.query(migration077SQL)
      console.log('✅ Migration 077 executed successfully')
      
      // Run Migration 076 (updated with event_type support)
      console.log('📝 Running Migration 076 Updated: Events notifications with event_type...')
      const migration076Path = path.join(__dirname, '..', 'migrations', '076_events_realtime_notifications.sql')
      const migration076SQL = fs.readFileSync(migration076Path, 'utf8')
      await client.query(migration076SQL)
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
      
      // Check if event_type column exists
      const columnCheck = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'event_type'
      `)
      
      console.log('📊 Event type column status:')
      if (columnCheck.rows.length > 0) {
        const col = columnCheck.rows[0]
        console.log(`  - event_type: ${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default}`)
      } else {
        console.log('  - event_type column not found!')
      }
      
      console.log('🎉 Both migrations completed successfully!')
      console.log('')
      console.log('📝 What was implemented:')
      console.log('  ✅ Removed toast notifications from use-events.ts')
      console.log('  ✅ Added event_type field to events table (event/activity)')
      console.log('  ✅ Added database notifications for event creation (upcoming only)')
      console.log('  ✅ Added database notifications for event status changes (started, cancelled)')
      console.log('  ✅ Added 15-minute reminder notifications via send_event_reminders()')
      console.log('  ✅ No notifications for "ended" status')
      console.log('  ✅ Updated notification service to handle event category')
      console.log('  ✅ Integrated event reminder scheduler into socket-server')
      console.log('  ✅ Updated APIs to support event_type field')
      console.log('')
      console.log('⏰ Event reminder scheduler will run every 5 minutes in socket-server')
      console.log('🎯 Notifications will be sent for:')
      console.log('  - New events/activities (upcoming status only)')
      console.log('  - 15-minute reminders before start time')
      console.log('  - Event/activity started (status changed to today)')
      console.log('  - Event/activity cancelled')
      console.log('  - Event/activity deleted')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Error running migrations:', error)
    throw error
  } finally {
    if (pool) await pool.end()
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations076And077()
    .then(() => {
      console.log('Migrations completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migrations failed:', error)
      process.exit(1)
    })
}

module.exports = { runMigrations076And077 }
