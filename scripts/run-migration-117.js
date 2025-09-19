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
    console.log('🔄 Starting migration 117: Remove assigned_at and sent_at from announcement_assignments...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '117_remove_assignment_timestamps.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 117 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Removed assigned_at column from announcement_assignments table')
      console.log('   - Removed sent_at column from announcement_assignments table')
      console.log('   - Dropped idx_announcement_assignments_sent_at index')
      console.log('   - Updated send_announcement() function to remove assignment sent_at updates')
      console.log('   - Updated get_user_announcements() function to use sent_at from main announcements table')
      console.log('   - Simplified announcement_assignments table structure')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 117 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
