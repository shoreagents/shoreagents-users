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
    console.log('🔄 Starting migration 095: Add assigned_user_ids to events table...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '095_add_assigned_users_to_events.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 095 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Added assigned_user_ids integer[] column to events table')
      console.log('   - Created GIN index for better query performance')
      console.log('   - Added helper functions for user assignment checking')
      console.log('   - Updated existing events to be visible to all users (backward compatibility)')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 095 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
