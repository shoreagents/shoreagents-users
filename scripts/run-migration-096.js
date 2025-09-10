const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function runMigration() {
  let pool = null
  try {
    console.log('🔄 Starting migration 096: Fix missing action_url in event reminder notifications...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '096_fix_event_reminder_action_url.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 096 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Updated send_event_reminders() function to include action_url in payload')
      console.log('   - Event reminder notifications now include clickable links to events page')
      console.log('   - Fixed missing action_url issue for "Event Reminder - Starting Soon" notifications')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 096 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
