const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testEventReminderFix() {
  let pool = null
  try {
    console.log('🧪 Testing event reminder fix...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Test the updated send_event_reminders function
      console.log('🔧 Testing send_event_reminders function...')
      const result = await client.query('SELECT send_event_reminders()')
      const notificationsSent = result.rows[0].send_event_reminders
      
      console.log(`📊 Notifications sent: ${notificationsSent}`)
      
      // Check recent event reminder notifications
      console.log('\n📋 Recent event reminder notifications:')
      const recentNotifications = await client.query(`
        SELECT 
          id,
          user_id,
          title,
          message,
          payload->>'action_url' as action_url,
          payload->>'event_id' as event_id,
          payload->>'notification_type' as notification_type,
          created_at
        FROM notifications 
        WHERE payload->>'notification_type' = 'event_reminder'
        ORDER BY created_at DESC 
        LIMIT 5
      `)
      
      recentNotifications.rows.forEach((notification, index) => {
        console.log(`\nNotification ${index + 1}:`)
        console.log(`  ID: ${notification.id}`)
        console.log(`  User: ${notification.user_id}`)
        console.log(`  Title: ${notification.title}`)
        console.log(`  Action URL: ${notification.action_url || 'MISSING'}`)
        console.log(`  Event ID: ${notification.event_id}`)
        console.log(`  Created: ${notification.created_at}`)
      })
      
      // Check if any notifications are missing action_url
      const missingActionUrl = recentNotifications.rows.filter(n => !n.action_url)
      if (missingActionUrl.length > 0) {
        console.log(`\n❌ Found ${missingActionUrl.length} notifications missing action_url`)
      } else {
        console.log('\n✅ All event reminder notifications have action_url!')
      }
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    if (pool) await pool.end()
  }
}

testEventReminderFix()
