const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function debugAPIQuery() {
  let pool = null
  try {
    console.log('🔍 Debugging API query for user 2...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Test the exact query from the API
      const query = `
        SELECT 
          e.id as event_id,
          e.title,
          e.assigned_user_ids,
          u.email as created_by_name
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.assigned_user_ids IS NULL 
           OR 2 = ANY(e.assigned_user_ids)
        ORDER BY e.event_date ASC, e.start_time ASC
      `
      
      console.log('🔍 Query:', query)
      console.log('🔍 User ID: 2')
      
      const result = await client.query(query)
      
      console.log('\n📊 Results:')
      console.log('Row count:', result.rowCount)
      
      result.rows.forEach((row, index) => {
        console.log(`\nRow ${index + 1}:`)
        console.log(`  ID: ${row.event_id}`)
        console.log(`  Title: ${row.title}`)
        console.log(`  Assigned IDs: ${JSON.stringify(row.assigned_user_ids)} (type: ${typeof row.assigned_user_ids})`)
        
        // Check if user 2 should see this event
        let shouldSee = false
        if (row.assigned_user_ids === null) {
          shouldSee = true
          console.log(`  ✅ Should see: YES (visible to all)`)
        } else if (Array.isArray(row.assigned_user_ids)) {
          shouldSee = row.assigned_user_ids.includes(2)
          console.log(`  ${shouldSee ? '✅' : '❌'} Should see: ${shouldSee ? 'YES' : 'NO'} (assigned to: ${row.assigned_user_ids.join(', ')})`)
        }
      })
      
      console.log(`\n📋 User 2 should see ${result.rows.length} events total`)
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Debug failed:', error)
  } finally {
    if (pool) await pool.end()
  }
}

debugAPIQuery()
