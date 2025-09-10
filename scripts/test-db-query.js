const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function testDBQuery() {
  let pool = null
  try {
    console.log('🧪 Testing database query...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Test the exact query from the API
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
           OR 1 = ANY(e.assigned_user_ids)
        ORDER BY e.event_date ASC, e.start_time ASC
        LIMIT 5
      `
      
      const result = await client.query(query)
      
      console.log('✅ Query successful!')
      console.log('Row count:', result.rowCount)
      
      result.rows.forEach((row, index) => {
        console.log(`\nRow ${index + 1}:`)
        console.log(`  Title: ${row.title}`)
        console.log(`  Assigned IDs: ${JSON.stringify(row.assigned_user_ids)} (type: ${typeof row.assigned_user_ids})`)
        
        // Test the conversion logic
        let converted = null
        try {
          if (row.assigned_user_ids !== null && row.assigned_user_ids !== undefined) {
            if (typeof row.assigned_user_ids === 'string') {
              const cleanString = row.assigned_user_ids.replace(/[{}]/g, '').trim()
              if (cleanString === '') {
                converted = []
              } else {
                converted = cleanString.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))
              }
            } else if (Array.isArray(row.assigned_user_ids)) {
              converted = row.assigned_user_ids
            }
          }
        } catch (error) {
          console.error('  Conversion error:', error.message)
        }
        
        console.log(`  Converted: ${JSON.stringify(converted)} (type: ${typeof converted})`)
      })
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    if (pool) await pool.end()
  }
}

testDBQuery()
