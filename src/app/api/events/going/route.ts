import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'
import { redisCache, cacheKeys } from '@/lib/redis-cache'

// Helper function to get user from request (matches pattern from other APIs)
function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    
    // Handle both hybrid and regular auth structures
    let userId = authData.user.id
    
    // If it's a hybrid auth system, use railway_id if available
    if (authData.hybrid && authData.user.railway_id) {
      userId = authData.user.railway_id
    }
    
    // Ensure we have a valid numeric ID
    if (!userId || isNaN(Number(userId))) {
      console.error('Invalid user ID:', userId)
      return null
    }
    
    return {
      ...authData.user,
      id: Number(userId)
    }
  } catch (error) {
    console.error('Error parsing auth cookie:', error)
    return null
  }
}

// POST /api/events/going - Mark user as going to an event
export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser?.email) {
      return NextResponse.json({ success: false, message: 'User not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { event_id } = body

    if (!event_id) {
      return NextResponse.json({ success: false, message: 'Event ID is required' }, { status: 400 })
    }

    const client = await getDatabaseClient()
    
    try {
      // Get user ID
      const userQuery = `SELECT id FROM users WHERE email = $1`
      const userResult = await client.query(userQuery, [currentUser.email])
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      }
      
      const userId = userResult.rows[0].id
      
      // Check if user is currently in a meeting
      const meetingCheckQuery = `SELECT is_user_in_meeting($1) as is_in_meeting`
      const meetingResult = await client.query(meetingCheckQuery, [userId])
      
      if (meetingResult.rows[0]?.is_in_meeting) {
        return NextResponse.json({ 
          success: false, 
          message: 'Cannot join event while in a meeting. Please end your meeting first.' 
        }, { status: 422 })
      }
      
      // Check if event exists and validate timing
      const eventQuery = `
        SELECT event_date, start_time, status, title
        FROM events 
        WHERE id = $1
      `
      const eventResult = await client.query(eventQuery, [parseInt(event_id)])
      
      if (eventResult.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 })
      }
      
      const event = eventResult.rows[0]
      
      // Check if event is cancelled or ended
      if (event.status === 'cancelled' || event.status === 'ended') {
        return NextResponse.json({ 
          success: false, 
          message: `Cannot join ${event.title} - Event is ${event.status}` 
        }, { status: 400 })
      }
      
      // Check if event is in the future or today but hasn't started yet
      const currentTime = new Date()
      const philippinesTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
      const today = philippinesTime.toISOString().split('T')[0]
      const currentTimeStr = philippinesTime.toTimeString().split(' ')[0]
      
      // Extract date part from event_date (handle both Date objects and date strings)
      const eventDate = event.event_date instanceof Date 
        ? event.event_date.toISOString().split('T')[0]
        : event.event_date.toString().includes('T') 
          ? event.event_date.toString().split('T')[0] 
          : event.event_date.toString()
      
      // Check if event is in the future
      if (eventDate > today) {
        return NextResponse.json({ 
          success: false, 
          message: `Cannot join ${event.title} - Event is scheduled for ${eventDate}` 
        }, { status: 400 })
      }
      
      // Check if event is today but hasn't started yet
      if (eventDate === today) {
        // Parse times for proper comparison
        const currentHours = philippinesTime.getHours()
        const currentMinutes = philippinesTime.getMinutes()
        const currentSeconds = philippinesTime.getSeconds()
        
        const [startHours, startMinutes, startSeconds] = event.start_time.split(':').map(Number)
        
        // Convert to total seconds for comparison
        const currentTotalSeconds = currentHours * 3600 + currentMinutes * 60 + currentSeconds
        const startTotalSeconds = startHours * 3600 + startMinutes * 60 + (startSeconds || 0)
        
        if (startTotalSeconds > currentTotalSeconds) {
          const startTimeFormatted = new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          })
          return NextResponse.json({ 
            success: false, 
            message: `Cannot join ${event.title} yet - Event starts at ${startTimeFormatted}` 
          }, { status: 400 })
        }
      }
      
      // Mark user as going using direct SQL with Philippines timezone
      const goingQuery = `
        INSERT INTO event_attendance (event_id, user_id, is_going, going_at, updated_at)
        VALUES ($1, $2, true, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
        ON CONFLICT (event_id, user_id)
        DO UPDATE SET 
          is_going = true,
          going_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila',
          updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        RETURNING id
      `
      
      const result = await client.query(goingQuery, [parseInt(event_id), userId])
      
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Failed to mark as going' }, { status: 500 })
      }

      // Invalidate Redis cache for events
      await redisCache.del(cacheKeys.events(currentUser.email))

      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error in POST /api/events/going:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    const errorName = error instanceof Error ? error.name : 'Unknown'
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: errorName
    })
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}
