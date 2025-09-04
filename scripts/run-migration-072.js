const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('Starting migration 072: Add clear column to notifications table...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '072_add_clear_column_to_notifications.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Execute the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration 072 completed successfully!')
    console.log('Added clear column to notifications table for soft deletion')
    
  } catch (error) {
    console.error('❌ Migration 072 failed:', error.message)
    throw error
  } finally {
    client.release()
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(() => {
    pool.end()
  })
