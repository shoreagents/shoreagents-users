const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function updateEventAssignments() {
  let pool = null
  try {
    console.log('🔄 Updating event assignments...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Get current users for reference
      const usersResult = await client.query('SELECT id, email FROM users ORDER BY id')
      console.log('\n📋 Available users:')
      usersResult.rows.forEach(user => {
        console.log(`   ID: ${user.id} | Email: ${user.email}`)
      })
      
      // Update events with specific assignments
      const assignments = [
        // Event ID 7: Monthly Review Meeting - assign to user 1 only
        { id: 7, title: 'Monthly Review Meeting', assigned_users: [1] },
        
        // Event ID 4: All Hands Meeting - keep visible to all (NULL)
        { id: 4, title: 'All Hands Meeting', assigned_users: null },
        
        // Event ID 13: Test Event - assign to users 1 and 2
        { id: 13, title: 'Test Event - Notification Check', assigned_users: [1, 2] },
        
        // Event ID 8: Holiday Party Planning - assign to all users (1, 2, 4)
        { id: 8, title: 'Holiday Party Planning Session', assigned_users: [1, 2, 4] },
        
        // Event ID 10: Office Renovation - keep visible to all (NULL)
        { id: 10, title: 'Cancelled: Office Renovation Meeting', assigned_users: null },
        
        // Event ID 3: Team Building - assign to users 1 and 4
        { id: 3, title: 'Team Building Activityy', assigned_users: [1, 4] },
        
        // Event ID 5: Product Launch Party - assign to all users (1, 2, 4)
        { id: 5, title: 'Product Launch Party', assigned_users: [1, 2, 4] },
        
        // Event ID 11: Health & Wellness - assign to user 2 only
        { id: 11, title: 'Health & Wellness Session', assigned_users: [2] },
        
        // Event ID 6: Training Workshop - assign to users 2 and 4
        { id: 6, title: 'Training Workshop: Customer Service Excellence', assigned_users: [2, 4] },
        
        // Event ID 12: Technology Update - assign to users 1 and 2
        { id: 12, title: 'Technology Update Briefing', assigned_users: [1, 2] },
        
        // Event ID 9: Client Presentation - hide from everyone (empty array)
        { id: 9, title: 'Client Presentation', assigned_users: [] }
      ]
      
      console.log('\n🔧 Updating event assignments...')
      
      for (const assignment of assignments) {
        let updateQuery, params
        
        if (assignment.assigned_users === null) {
          // Set to NULL (visible to all)
          updateQuery = 'UPDATE events SET assigned_user_ids = NULL WHERE id = $1'
          params = [assignment.id]
        } else if (assignment.assigned_users.length === 0) {
          // Set to empty array (hidden from all)
          updateQuery = 'UPDATE events SET assigned_user_ids = ARRAY[]::integer[] WHERE id = $1'
          params = [assignment.id]
        } else {
          // Set to specific user IDs
          updateQuery = 'UPDATE events SET assigned_user_ids = $2 WHERE id = $1'
          params = [assignment.id, assignment.assigned_users]
        }
        
        const result = await client.query(updateQuery, params)
        
        if (result.rowCount > 0) {
          const userList = assignment.assigned_users === null 
            ? 'ALL USERS' 
            : assignment.assigned_users.length === 0 
              ? 'NO ONE (hidden)'
              : assignment.assigned_users.join(', ')
          console.log(`   ✅ Event ${assignment.id}: "${assignment.title}" → Users: ${userList}`)
        } else {
          console.log(`   ❌ Event ${assignment.id}: "${assignment.title}" not found`)
        }
      }
      
      // Show final assignments
      console.log('\n📊 Final event assignments:')
      const finalResult = await client.query(`
        SELECT id, title, assigned_user_ids 
        FROM events 
        ORDER BY id
      `)
      
      finalResult.rows.forEach(event => {
        let userList
        if (event.assigned_user_ids === null) {
          userList = 'ALL USERS'
        } else if (event.assigned_user_ids.length === 0) {
          userList = 'NO ONE (hidden)'
        } else {
          userList = event.assigned_user_ids.join(', ')
        }
        console.log(`   Event ${event.id}: "${event.title}" → Users: ${userList}`)
      })
      
      console.log('\n✅ Event assignments updated successfully!')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Update failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

updateEventAssignments()
