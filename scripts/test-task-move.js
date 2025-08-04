const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function testTaskMove() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('Testing task movement...')
    
    // Get current task positions
    const currentPositions = await pool.query(`
      SELECT group_id, id, title, position 
      FROM tasks 
      WHERE status = 'active'
      ORDER BY group_id, position
    `)
    
    console.log('\nCurrent task positions:')
    currentPositions.rows.forEach(row => {
      console.log(`Group ${row.group_id}: Task ${row.id} (${row.title}) at position ${row.position}`)
    })
    
    // Test moving a task (you can modify these values)
    const testTaskId = currentPositions.rows[0]?.id
    const testGroupId = currentPositions.rows[0]?.group_id
    const testTargetPosition = 1
    
    if (testTaskId && testGroupId) {
      console.log(`\nTesting move: Task ${testTaskId} to Group ${testGroupId} at position ${testTargetPosition}`)
      
      // Simulate the move operation
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        
        // Shift tasks
        await client.query(`
          UPDATE tasks 
          SET position = position + 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE group_id = $1 AND status = 'active' AND position >= $2
        `, [testGroupId, testTargetPosition])
        
        // Move task
        await client.query(`
          UPDATE tasks 
          SET group_id = $1, position = $2, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $3
          RETURNING *
        `, [testGroupId, testTargetPosition, testTaskId])
        
        await client.query('COMMIT')
        console.log('✅ Test move completed successfully')
        
      } catch (error) {
        await client.query('ROLLBACK')
        console.error('❌ Test move failed:', error.message)
      } finally {
        client.release()
      }
    }
    
    // Show final positions
    const finalPositions = await pool.query(`
      SELECT group_id, id, title, position 
      FROM tasks 
      WHERE status = 'active'
      ORDER BY group_id, position
    `)
    
    console.log('\nFinal task positions:')
    finalPositions.rows.forEach(row => {
      console.log(`Group ${row.group_id}: Task ${row.id} (${row.title}) at position ${row.position}`)
    })
    
  } catch (error) {
    console.error('❌ Error testing task move:', error)
  } finally {
    await pool.end()
  }
}

testTaskMove() 