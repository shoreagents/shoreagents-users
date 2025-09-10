const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testNewFiltering() {
  let pool = null
  try {
    console.log('🧪 Testing new filtering (NULL events are hidden)...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      const users = [
        { id: 1, email: 'agent@shoreagents.com' },
        { id: 2, email: 'kyle.p@shoreagents.com' },
        { id: 4, email: 'kylepantig@gmail.com' }
      ]
      
      for (const user of users) {
        console.log(`\n👤 Testing for User ${user.id} (${user.email}):`)
        
        // Test the new query (NULL events are hidden)
        const query = `
          SELECT 
            e.id as event_id,
            e.title,
            e.assigned_user_ids,
            u.email as created_by_name
          FROM events e
          LEFT JOIN users u ON e.created_by = u.id
          WHERE e.assigned_user_ids IS NOT NULL 
             AND $1 = ANY(e.assigned_user_ids)
          ORDER BY e.event_date ASC, e.start_time ASC
        `
        
        const result = await client.query(query, [user.id])
        
        console.log(`   📊 User ${user.id} can see ${result.rows.length} events:`)
        result.rows.forEach(event => {
          const assignment = event.assigned_user_ids 
            ? `(assigned to: ${event.assigned_user_ids.join(', ')})` 
            : '(visible to all)'
          console.log(`      - ${event.title} ${assignment}`)
        })
      }
      
      // Show all events and their assignments
      console.log('\n📋 All events and their assignments:')
      const allEventsQuery = `
        SELECT id, title, assigned_user_ids 
        FROM events 
        ORDER BY id
      `
      const allEventsResult = await client.query(allEventsQuery)
      
      allEventsResult.rows.forEach(event => {
        let userList
        if (event.assigned_user_ids === null) {
          userList = 'HIDDEN FROM ALL (NULL)'
        } else if (event.assigned_user_ids.length === 0) {
          userList = 'NO ONE (hidden)'
        } else {
          userList = event.assigned_user_ids.join(', ')
        }
        console.log(`   Event ${event.id}: "${event.title}" → Users: ${userList}`)
      })
      
      console.log('\n✅ New filtering test completed!')
      console.log('\n📋 Summary:')
      console.log('   - Events with assigned_user_ids = NULL are now HIDDEN from all users')
      console.log('   - Only events with specific user assignments are visible')
      console.log('   - Events with assigned_user_ids = [] are still hidden from all users')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    if (pool) await pool.end()
  }
}

testNewFiltering()
