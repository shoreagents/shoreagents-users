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
    console.log('🔄 Starting migration 121: Fix create_announcement_assignments function...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Read the migration file
      const migrationPath = path.join(__dirname, '..', 'migrations', '121_fix_create_assignments_function.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Execute the migration
      await client.query(migrationSQL)
      
      console.log('✅ Migration 121 completed successfully!')
      console.log('📋 Changes made:')
      console.log('   - Fixed create_announcement_assignments() function to remove assigned_at reference')
      console.log('   - Updated INSERT statement to only use announcement_id and user_id')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Migration 121 failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

runMigration()
