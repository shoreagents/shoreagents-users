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
    console.log('🔄 Running migration 063: Restore start_meeting validation...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '063_restore_start_meeting_validation.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration 063 completed successfully!')
    console.log('   - Restored start_meeting function with proper validation')
    console.log('   - Prevents starting meetings with future start times')
    
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
