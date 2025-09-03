const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database configuration - use the same connection string as the working migration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

const pool = new Pool(databaseConfig)

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Running migration 062: Fix get_active_meeting function...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '062_fix_get_active_meeting_function.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration 062 completed successfully!')
    console.log('   - Fixed get_active_meeting function to remove actual_start_time reference')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  })
