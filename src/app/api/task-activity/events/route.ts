import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200)
    
    // Log the full request details for debugging
    console.log(`🌐 Request URL: ${request.url}`)
    console.log(`🔍 Search params:`, Object.fromEntries(searchParams.entries()))
    console.log(`📝 Raw task_id from params: "${taskId}" (type: ${typeof taskId})`)
    
    if (!taskId) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
    }
    
    // Validate task_id is a valid integer
    const parsedTaskId = parseInt(taskId, 10)
    if (isNaN(parsedTaskId) || parsedTaskId <= 0) {
      return NextResponse.json({ 
        error: 'Invalid task_id format. Must be a positive integer.',
        received: taskId,
        parsed: parsedTaskId
      }, { status: 400 })
    }
    
    console.log(`🔍 Fetching events for task_id: ${parsedTaskId} (original: ${taskId})`)
    
    const pool = getPool()
    
    try {
      // Verify database connection
      const connectionTest = await pool.query('SELECT 1 as test')
      console.log(`✅ Database connection test: ${connectionTest.rows[0].test}`)
      
      // First, verify the task exists
      const taskCheck = await pool.query(
        'SELECT id, title FROM tasks WHERE id = $1',
        [parsedTaskId]
      )
      
      if (taskCheck.rows.length === 0) {
        console.log(`⚠️ Task ${parsedTaskId} not found in database`)
        return NextResponse.json({ 
          error: 'Task not found',
          task_id: parsedTaskId
        }, { status: 404 })
      }
      
      console.log(`✅ Task ${parsedTaskId} found: "${taskCheck.rows[0].title}"`)
      
      // Check total events in the database for debugging
      const totalEventsCheck = await pool.query(
        'SELECT COUNT(*) as total_events FROM task_activity_events'
      )
      console.log(`📊 Total events in database: ${totalEventsCheck.rows[0].total_events}`)
      
      // Check for events with NULL task_id (data integrity issue)
      const nullTaskIdCheck = await pool.query(
        'SELECT COUNT(*) as null_task_events FROM task_activity_events WHERE task_id IS NULL'
      )
      if (nullTaskIdCheck.rows[0].null_task_events > 0) {
        console.error(`❌ DATA INTEGRITY ISSUE: Found ${nullTaskIdCheck.rows[0].null_task_events} events with NULL task_id!`)
      }
      
      // Check events for this specific task
      const taskEventsCheck = await pool.query(
        'SELECT COUNT(*) as task_events FROM task_activity_events WHERE task_id = $1',
        [parsedTaskId]
      )
      console.log(`📊 Events for task ${parsedTaskId}: ${taskEventsCheck.rows[0].task_events}`)
      
      // If no events for this task, return empty array immediately
      if (taskEventsCheck.rows[0].task_events === '0') {
        console.log(`ℹ️ No events found for task ${parsedTaskId}, returning empty array`)
        return NextResponse.json({ 
          success: true, 
          events: [],
          task_id: parsedTaskId,
          task_title: taskCheck.rows[0].title,
          event_count: 0,
          message: 'No events found for this task'
        })
      }
      
      // Fetch events with strict filtering and explicit task_id check
      const rows = await pool.query(
        `SELECT id, task_id, actor_user_id, action, details, created_at
         FROM task_activity_events
         WHERE task_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT $2`,
        [parsedTaskId, limit]
      )
      
      console.log(`📊 Query returned ${rows.rows.length} events for task ${parsedTaskId}`)
      
      // Test the query with a raw string to see if there's a parameter binding issue
      const rawQueryTest = await pool.query(
        `SELECT id, task_id, action, created_at
         FROM task_activity_events
         WHERE task_id = ${parsedTaskId}
         ORDER BY created_at DESC
         LIMIT 5`
      )
      console.log(`🔍 Raw query test for task ${parsedTaskId}:`, rawQueryTest.rows)
      
      // Double-check the query results - ensure ALL events belong to the requested task
      const invalidEvents = rows.rows.filter((event: any) => {
        const isValid = event.task_id === parsedTaskId
        if (!isValid) {
          console.error(`❌ INVALID EVENT: Event ${event.id} has task_id ${event.task_id}, expected ${parsedTaskId}`)
        }
        return !isValid
      })
      
      if (invalidEvents.length > 0) {
        console.error(`❌ CRITICAL: Found ${invalidEvents.length} events with wrong task_id!`, invalidEvents)
        
        // Let's also check what's in the database for this task_id
        const debugQuery = await pool.query(
          `SELECT id, task_id, action, created_at 
           FROM task_activity_events 
           WHERE task_id = $1 
           ORDER BY created_at DESC 
           LIMIT 5`,
          [parsedTaskId]
        )
        console.log(`🔍 Debug query for task ${parsedTaskId}:`, debugQuery.rows)
        
        return NextResponse.json({ 
          error: 'Data integrity issue detected',
          message: 'Events returned for wrong task',
          requested_task_id: parsedTaskId,
          invalid_events: invalidEvents,
          debug_info: {
            total_events_in_db: totalEventsCheck.rows[0].total_events,
            events_for_task: taskEventsCheck.rows[0].task_events,
            query_returned: rows.rows.length,
            invalid_count: invalidEvents.length
          }
        }, { status: 500 })
      }
      
      // Log first few events for debugging
      if (rows.rows.length > 0) {
        console.log(`📝 Sample events:`, rows.rows.slice(0, 3).map((e: any) => ({
          id: e.id,
          task_id: e.task_id,
          action: e.action,
          created_at: e.created_at
        })))
      }
      
      return NextResponse.json({ 
        success: true, 
        events: rows.rows,
        task_id: parsedTaskId,
        task_title: taskCheck.rows[0].title,
        event_count: rows.rows.length
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('❌ Error in task activity events API:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}


