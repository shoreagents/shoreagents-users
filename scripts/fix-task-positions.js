const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function fixTaskPositions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('Connecting to database...')
    await pool.query('SELECT NOW()')
    console.log('Connected successfully')

    console.log('Reading migration file...')
    const fs = require('fs')
    const path = require('path')
    const migrationPath = path.join(__dirname, '../migrations/026_fix_task_positions.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('Executing migration...')
    await pool.query(migrationSQL)
    
    console.log('✅ Task positions fixed successfully!')
    
    // Verify the fix
    console.log('\nVerifying positions...')
    const result = await pool.query(`
      SELECT 
        group_id,
        COUNT(*) as task_count,
        COUNT(DISTINCT position) as unique_positions,
        MIN(position) as min_position,
        MAX(position) as max_position
      FROM tasks 
      WHERE status = 'active'
      GROUP BY group_id
      ORDER BY group_id
    `)
    
    console.log('\nPosition verification:')
    result.rows.forEach(row => {
      const status = row.task_count === row.unique_positions ? '✅' : '❌'
      console.log(`${status} Group ${row.group_id}: ${row.task_count} tasks, positions ${row.min_position}-${row.max_position}`)
    })
    
  } catch (error) {
    console.error('❌ Error fixing task positions:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

fixTaskPositions() 