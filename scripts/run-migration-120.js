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
    console.log('🔄 Starting migration 120: Clean up remaining schema references...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '120_cleanup_schema_references.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 120 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Updated create_announcement() function to remove announcement_type')
      console.log('   - Updated create_scheduled_announcement() function to remove announcement_type')
      console.log('   - Cleaned up remaining schema references')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 120 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
