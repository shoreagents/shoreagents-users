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
    console.log('🔄 Starting migration 119: Fix announcement trigger to remove announcement_type reference...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '119_fix_announcement_trigger.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 119 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Updated notify_announcement_change() function to remove announcement_type reference')
      console.log('   - Recreated announcements_notify_trigger without announcement_type')
      console.log('   - Fixed trigger error when creating announcements')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 119 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
