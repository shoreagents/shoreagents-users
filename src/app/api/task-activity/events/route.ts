import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200)
    
    // Log the full request details for debugging
    
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
    
    
    // First, verify the task exists
    const taskCheck = await executeQuery(
      'SELECT id, title FROM tasks WHERE id = $1',
      [parsedTaskId]
    )
    
    if (taskCheck.length === 0) {
      return NextResponse.json({ 
        error: 'Task not found',
        task_id: parsedTaskId
      }, { status: 404 })
    }
    
    
    // Check total events in the database for debugging
    const totalEventsCheck = await executeQuery(
      'SELECT COUNT(*) as total_events FROM task_activity_events'
    )
    
    // Check for events with NULL task_id (data integrity issue)
    const nullTaskIdCheck = await executeQuery(
      'SELECT COUNT(*) as null_task_events FROM task_activity_events WHERE task_id IS NULL'
    )
    if (nullTaskIdCheck[0].null_task_events > 0) {
      console.error(`DATA INTEGRITY ISSUE: Found ${nullTaskIdCheck[0].null_task_events} events with NULL task_id!`)
    }
    
    // Check events for this specific task
    const taskEventsCheck = await executeQuery(
      'SELECT COUNT(*) as task_events FROM task_activity_events WHERE task_id = $1',
      [parsedTaskId]
    )
    
    // If no events for this task, return empty array immediately
    if (taskEventsCheck[0].task_events === '0') {
      return NextResponse.json({ 
        success: true, 
        events: [],
        task_id: parsedTaskId,
        task_title: taskCheck[0].title,
        event_count: 0,
        message: 'No events found for this task'
      })
    }
    
    // Fetch events with strict filtering and explicit task_id check
    const rows = await executeQuery(
      `SELECT id, task_id, actor_user_id, action, details, created_at
       FROM task_activity_events
       WHERE task_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [parsedTaskId, limit]
    )
    
    
    // Test the query with a raw string to see if there's a parameter binding issue
    const rawQueryTest = await executeQuery(
      `SELECT id, task_id, action, created_at
       FROM task_activity_events
       WHERE task_id = ${parsedTaskId}
       ORDER BY created_at DESC
       LIMIT 5`
    )
    
    // Double-check the query results - ensure ALL events belong to the requested task
    const invalidEvents = rows.filter((event: any) => {
      const isValid = event.task_id === parsedTaskId
      if (!isValid) {
        console.error(`INVALID EVENT: Event ${event.id} has task_id ${event.task_id}, expected ${parsedTaskId}`)
      }
      return !isValid
    })
    
    if (invalidEvents.length > 0) {
      console.error(`CRITICAL: Found ${invalidEvents.length} events with wrong task_id!`, invalidEvents)
      
      // Let's also check what's in the database for this task_id
      const debugQuery = await executeQuery(
        `SELECT id, task_id, action, created_at 
         FROM task_activity_events 
         WHERE task_id = $1 
         ORDER BY created_at DESC 
         LIMIT 5`,
        [parsedTaskId]
      )
      // Debug query results
      
      return NextResponse.json({ 
        error: 'Data integrity issue detected',
        message: 'Events returned for wrong task',
        requested_task_id: parsedTaskId,
        invalid_events: invalidEvents,
        debug_info: {
          total_events_in_db: totalEventsCheck[0].total_events,
          events_for_task: taskEventsCheck[0].task_events,
          query_returned: rows.length,
          invalid_count: invalidEvents.length
        }
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      events: rows,
      task_id: parsedTaskId,
      task_title: taskCheck[0].title,
      event_count: rows.length
    })
    
  } catch (e) {
    console.error('Error in task activity events API:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}


