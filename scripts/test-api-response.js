const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testAPIResponse() {
  let pool = null
  try {
    console.log('🧪 Testing API response format...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Simulate the exact API query
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
          u.email as created_by_name,
          COALESCE(ea.is_going, false) as is_going,
          COALESCE(ea.is_back, false) as is_back,
          ea.going_at AT TIME ZONE 'Asia/Manila' as going_at,
          ea.back_at AT TIME ZONE 'Asia/Manila' as back_at
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = 1
        WHERE e.assigned_user_ids IS NULL 
           OR 1 = ANY(e.assigned_user_ids)
        ORDER BY e.event_date ASC, e.start_time ASC
        LIMIT 5
      `
      
      const result = await client.query(query)
      
      console.log('\n📊 Raw database response (first 5 events):')
      result.rows.forEach((row, index) => {
        console.log(`\nEvent ${index + 1}:`)
        console.log(`  ID: ${row.event_id}`)
        console.log(`  Title: ${row.title}`)
        console.log(`  Raw assigned_user_ids: ${JSON.stringify(row.assigned_user_ids)} (type: ${typeof row.assigned_user_ids})`)
        
        // Apply the same conversion as the API
        const converted = row.assigned_user_ids 
          ? row.assigned_user_ids.replace(/[{}]/g, '').split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
          : null
        
        console.log(`  Converted assigned_user_ids: ${JSON.stringify(converted)} (type: ${typeof converted})`)
        console.log(`  Is Array: ${Array.isArray(converted)}`)
      })
      
      console.log('\n✅ API response format test completed!')
      
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

testAPIResponse()
