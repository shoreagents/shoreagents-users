const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testAPIConversion() {
  let pool = null
  try {
    console.log('🧪 Testing API conversion logic...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Test the exact query from the API for user 2
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
           OR 2 = ANY(e.assigned_user_ids)
        ORDER BY e.event_date ASC, e.start_time ASC
      `
      
      const result = await client.query(query)
      
      console.log('✅ Query successful!')
      console.log('Row count:', result.rowCount)
      
      // Apply the same conversion logic as the API
      const events = result.rows.map(row => ({
        ...row,
        assigned_user_ids: row.assigned_user_ids 
          ? (typeof row.assigned_user_ids === 'string' 
              ? row.assigned_user_ids.replace(/[{}]/g, '').split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))
              : row.assigned_user_ids)
          : null
      }))
      
      console.log('\n📊 Events for User 2 after conversion:')
      events.forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`)
        console.log(`  Title: ${event.title}`)
        console.log(`  Raw assigned_user_ids: ${JSON.stringify(event.assigned_user_ids)} (type: ${typeof event.assigned_user_ids})`)
        console.log(`  Is Array: ${Array.isArray(event.assigned_user_ids)}`)
        
        if (Array.isArray(event.assigned_user_ids)) {
          console.log(`  Contains user 2: ${event.assigned_user_ids.includes(2)}`)
        }
      })
      
      console.log(`\n✅ User 2 should see ${events.length} events`)
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    if (pool) await pool.end()
  }
}

testAPIConversion()
