const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database configuration - use the same connection string as the working migration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function runMigration() {
  const pool = new Pool(databaseConfig)
  const client = await pool.connect()
  
  try {
    console.log('🔄 Running migration 060: Fix meeting functions without actual_start_time...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '060_fix_meeting_functions_no_actual_start_time.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration 060 completed successfully!')
    console.log('   - Updated end_meeting function to use start_time only')
    console.log('   - Updated start_meeting function without actual_start_time')
    
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
