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
    console.log('🔄 Starting migration 118: Remove announcement_type enum and column...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '118_remove_announcement_type.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 118 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Removed announcement_type column from announcements table')
      console.log('   - Dropped announcement_type_enum type')
      console.log('   - Updated get_user_announcements() function to remove announcement_type')
      console.log('   - Updated send_announcement() function to remove announcement_type from notifications')
      console.log('   - Simplified announcement schema by removing unnecessary type classification')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 118 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
