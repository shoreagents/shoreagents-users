const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testUserAssignment() {
  let pool = null
  try {
    console.log('🧪 Testing user assignment feature...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // First, let's see what users we have
      console.log('\n📋 Available users:')
      const usersResult = await client.query('SELECT id, email FROM users ORDER BY id LIMIT 10')
      usersResult.rows.forEach(user => {
        console.log(`   ID: ${user.id} | Email: ${user.email}`)
      })
      
      // Let's assign some events to specific users for testing
      console.log('\n🔧 Assigning events to specific users for testing...')
      
      // Assign Monthly Review Meeting to user ID 1 only
      await client.query(`
        UPDATE events 
        SET assigned_user_ids = ARRAY[1] 
        WHERE id = 7 AND title = 'Monthly Review Meeting'
      `)
      console.log('   ✅ Monthly Review Meeting assigned to user ID 1 only')
      
      // Assign Technology Update Briefing to users 1 and 2
      await client.query(`
        UPDATE events 
        SET assigned_user_ids = ARRAY[1, 2] 
        WHERE id = 12 AND title = 'Technology Update Briefing'
      `)
      console.log('   ✅ Technology Update Briefing assigned to users 1 and 2')
      
      // Make Client Presentation visible to no one (hidden)
      await client.query(`
        UPDATE events 
        SET assigned_user_ids = ARRAY[]::integer[] 
        WHERE id = 9 AND title = 'Client Presentation'
      `)
      console.log('   ✅ Client Presentation hidden from all users')
      
      // Show current event assignments
      console.log('\n📊 Current event assignments:')
      const eventsResult = await client.query(`
        SELECT id, title, assigned_user_ids 
        FROM events 
        WHERE assigned_user_ids IS NOT NULL 
        ORDER BY id
      `)
      
      eventsResult.rows.forEach(event => {
        const userList = event.assigned_user_ids.length > 0 
          ? event.assigned_user_ids.join(', ') 
          : 'NO ONE (hidden)'
        console.log(`   Event ${event.id}: "${event.title}" → Users: ${userList}`)
      })
      
      console.log('\n✅ Test assignments completed!')
      console.log('\n🔍 Now test the API:')
      console.log('   - User 1 should see: Monthly Review Meeting, Technology Update Briefing, and all NULL events')
      console.log('   - User 2 should see: Technology Update Briefing and all NULL events')
      console.log('   - User 3+ should see: Only events with assigned_user_ids = NULL')
      console.log('   - No one should see: Client Presentation (hidden)')
      
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

testUserAssignment()
