const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function runMigration() {
  try {
    console.log('🔄 Running migration 075: Fix timezone to Philippines (UTC+8)')
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/075_fix_timezone_philippines.sql'),
      'utf8'
    )
    
    await pool.query(migrationSQL)
    
    console.log('✅ Migration 075 completed successfully')
    console.log('📅 All timestamps now use Asia/Manila timezone (UTC+8)')
    
  } catch (error) {
    console.error('❌ Migration 075 failed:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

runMigration()
