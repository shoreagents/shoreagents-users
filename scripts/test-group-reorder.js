require('dotenv').config()
const { Pool } = require('pg')

async function testGroupReorder() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  })

  try {
    console.log('Testing group reordering...')
    
    // Get current group positions
    const getGroupsQuery = `
      SELECT id, title, position 
      FROM task_groups 
      WHERE user_id = 1
      ORDER BY position
    `
    const groupsResult = await pool.query(getGroupsQuery)
    console.log('\nCurrent group positions:')
    groupsResult.rows.forEach(group => {
      console.log(`Group ${group.id} (${group.title}): Position ${group.position}`)
    })
    
    // Simulate reordering groups
    console.log('\nSimulating group reorder...')
    const newPositions = [
      { id: 2, position: 0 }, // Move group 2 to position 0
      { id: 1, position: 1 }, // Move group 1 to position 1
      { id: 3, position: 2 }, // Move group 3 to position 2
      { id: 4, position: 3 }  // Move group 4 to position 3
    ]
    
    // Update positions
    for (const groupPos of newPositions) {
      const updateQuery = `
        UPDATE task_groups 
        SET position = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $2 AND user_id = 1
      `
      await pool.query(updateQuery, [groupPos.position, groupPos.id])
      console.log(`Updated group ${groupPos.id} to position ${groupPos.position}`)
    }
    
    // Get updated positions
    const updatedGroupsResult = await pool.query(getGroupsQuery)
    console.log('\nAfter reordering:')
    updatedGroupsResult.rows.forEach(group => {
      console.log(`Group ${group.id} (${group.title}): Position ${group.position}`)
    })
    
    console.log('\n✅ Group reordering test completed')
    
  } catch (error) {
    console.error('Error testing group reordering:', error)
  } finally {
    await pool.end()
  }
}

testGroupReorder() 