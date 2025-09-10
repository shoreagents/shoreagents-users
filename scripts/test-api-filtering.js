const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testAPIFiltering() {
  let pool = null
  try {
    console.log('🧪 Testing API filtering for different users...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Test the filtering logic for different users
      const users = [
        { id: 1, email: 'agent@shoreagents.com' },
        { id: 2, email: 'kyle.p@shoreagents.com' },
        { id: 4, email: 'kylepantig@gmail.com' }
      ]
      
      for (const user of users) {
        console.log(`\n👤 Testing for User ${user.id} (${user.email}):`)
        
        // Simulate the API query
        const query = `
          SELECT 
            e.id as event_id,
            e.title,
            e.description,
            e.event_date AT TIME ZONE 'Asia/Manila' as event_date,
            e.start_time,
            e.end_time,
            e.location,
            e.status,
            e.event_type,
            e.assigned_user_ids,
            u.email as created_by_name
          FROM events e
          LEFT JOIN users u ON e.created_by = u.id
          WHERE e.assigned_user_ids IS NULL 
             OR $1 = ANY(e.assigned_user_ids)
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
      
      console.log('\n✅ API filtering test completed!')
      console.log('\n📋 Summary:')
      console.log('   - Events with assigned_user_ids = NULL are visible to ALL users')
      console.log('   - Events with assigned_user_ids = [1,2] are visible to users 1 and 2')
      console.log('   - Events with assigned_user_ids = [1] are visible only to user 1')
      console.log('   - Events with assigned_user_ids = [] are hidden from ALL users')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

testAPIFiltering()
