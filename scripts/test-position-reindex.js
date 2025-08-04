require('dotenv').config()
const { Pool } = require('pg')

async function testPositionReindex() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('Testing position re-indexing...')
    
    // Get current task positions
    const getTasksQuery = `
      SELECT id, title, group_id, position 
      FROM tasks 
      WHERE status = 'active' 
      ORDER BY group_id, position
    `
    const tasksResult = await pool.query(getTasksQuery)
    console.log('\nCurrent task positions:')
    tasksResult.rows.forEach(task => {
      console.log(`Task ${task.id} (${task.title}): Group ${task.group_id}, Position ${task.position}`)
    })
    
    // Simulate moving a task from group 1 to group 2
    console.log('\nSimulating move of task from group 1 to group 2...')
    
    // Find a task in group 1
    const group1Tasks = tasksResult.rows.filter(t => t.group_id === 1)
    if (group1Tasks.length === 0) {
      console.log('No tasks in group 1 found')
      return
    }
    
    const taskToMove = group1Tasks[0]
    console.log(`Moving task ${taskToMove.id} (${taskToMove.title}) from group ${taskToMove.group_id} position ${taskToMove.position}`)
    
    // Simulate the re-indexing logic
    const reindexSourceQuery = `
      UPDATE tasks 
      SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
      WHERE group_id = $1 AND status = 'active' AND position > $2
    `
    await pool.query(reindexSourceQuery, [taskToMove.group_id, taskToMove.position])
    
    // Get updated positions
    const updatedTasksResult = await pool.query(getTasksQuery)
    console.log('\nAfter re-indexing source group:')
    updatedTasksResult.rows.forEach(task => {
      console.log(`Task ${task.id} (${task.title}): Group ${task.group_id}, Position ${task.position}`)
    })
    
    console.log('\n✅ Position re-indexing test completed')
    
  } catch (error) {
    console.error('Error testing position re-indexing:', error)
  } finally {
    await pool.end()
  }
}

testPositionReindex() 