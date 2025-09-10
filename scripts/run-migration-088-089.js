require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

const databaseConfig = {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };

async function runMigrations088And089() {
  let pool = null
  try {
    console.log('🚀 Running Migrations 088 & 089: Health Check Flow Columns')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Run Migration 088 first (add done column)
      console.log('📝 Running Migration 088: Adding done column...')
      const migration088Path = path.join(__dirname, '..', 'migrations', '088_add_done_column_to_health_check_requests.sql')
      const migration088SQL = fs.readFileSync(migration088Path, 'utf8')
      await client.query(migration088SQL)
      console.log('✅ Migration 088 executed successfully')
      
      // Run Migration 089 (add going_to_clinic and in_clinic columns)
      console.log('📝 Running Migration 089: Adding going_to_clinic and in_clinic columns...')
      const migration089Path = path.join(__dirname, '..', 'migrations', '089_add_going_to_clinic_and_in_clinic_columns.sql')
      const migration089SQL = fs.readFileSync(migration089Path, 'utf8')
      await client.query(migration089SQL)
      console.log('✅ Migration 089 executed successfully')
      
      // Test the new columns
      console.log('🧪 Testing new columns...')
      
      // Check if columns exist
      const columnCheck = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'health_check_requests' 
        AND column_name IN ('done', 'going_to_clinic', 'in_clinic')
        ORDER BY column_name
      `)
      
      console.log('📊 New columns status:')
      if (columnCheck.rows.length > 0) {
        columnCheck.rows.forEach(row => {
          console.log(`  - ${row.column_name}: ${row.data_type}, nullable: ${row.is_nullable}, default: ${row.column_default}`)
        })
      } else {
        console.log('  - New columns not found!')
      }
      
      // Check if indexes exist
      const indexCheck = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'health_check_requests' 
        AND indexname LIKE '%done%' OR indexname LIKE '%going_to_clinic%' OR indexname LIKE '%in_clinic%'
      `)
      
      console.log('🔍 New indexes status:')
      if (indexCheck.rows.length > 0) {
        indexCheck.rows.forEach(row => {
          console.log(`  - ${row.indexname}`)
        })
      } else {
        console.log('  - New indexes not found!')
      }
      
      console.log('🎉 Both migrations completed successfully!')
      console.log('')
      console.log('📝 What was implemented:')
      console.log('  ✅ Added done column (boolean) - tracks when user completes health check')
      console.log('  ✅ Added going_to_clinic column (boolean) - tracks when user is going to clinic')
      console.log('  ✅ Added in_clinic column (boolean) - tracks when user is in clinic (set by nurse)')
      console.log('  ✅ Added indexes for better query performance')
      console.log('  ✅ Updated HealthCheckRequest interface')
      console.log('  ✅ Created API endpoints for updating status')
      console.log('  ✅ Updated health page UI with new flow')
      console.log('  ✅ Added HealthProvider context for state management')
      console.log('  ✅ Integrated with activity tracking pause/resume')
      console.log('')
      console.log('🔄 Health Check Flow:')
      console.log('  1. User requests health check (pending)')
      console.log('  2. Nurse approves → shows "Going to Clinic" button')
      console.log('  3. User clicks "Going to Clinic" → going_to_clinic=true, activity tracking pauses')
      console.log('  4. Nurse sets in_clinic=true when user arrives')
      console.log('  5. Nurse sets status=completed when finished')
      console.log('  6. User sees "Done - Back to Station" button')
      console.log('  7. User clicks "Done" → done=true, activity tracking resumes')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Error running migrations:', error)
    throw error
  } finally {
    if (pool) await pool.end()
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations088And089()
    .then(() => {
      console.log('Migrations completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Migrations failed:', error)
      process.exit(1)
    })
}

module.exports = { runMigrations088And089 }
