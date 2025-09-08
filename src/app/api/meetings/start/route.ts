import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache } from '@/lib/redis-cache'

// Helper function to get user from request
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

// POST /api/meetings/start - Start a meeting
export async function POST(request: NextRequest) {
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser?.email) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { meetingId, agent_user_id } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    if (!agent_user_id) {
      return NextResponse.json({ error: 'Agent user ID is required' }, { status: 400 })
    }

    // Check if user is currently in an event
    const eventCheckQuery = `
      SELECT ea.is_going, e.title as event_title
      FROM event_attendance ea
      JOIN events e ON ea.event_id = e.id
      WHERE ea.user_id = $1 AND ea.is_going = true AND ea.is_back = false
      AND e.status NOT IN ('cancelled', 'ended')
    `
    const eventResult = await executeQuery(eventCheckQuery, [currentUser.id])
    
    if (eventResult.length > 0) {
      const eventTitle = eventResult[0].event_title
      return NextResponse.json({ 
        error: `Cannot start meeting while in event: ${eventTitle}. Please leave the event first.` 
      }, { status: 422 })
    }

    // Use the database function to start the meeting with proper validation
    // Pass false for is_automatic to indicate this is a manual start (no notifications)
    const query = `SELECT start_meeting($1, $2, $3)`
    const result = await executeQuery(query, [meetingId, agent_user_id, false])

    if (!result[0]?.start_meeting) {
      return NextResponse.json({ error: 'Failed to start meeting. Meeting may not exist or is not in scheduled status.' }, { status: 400 })
    }

    // Parse the JSON result if it's a string
    let startResult
    try {
      startResult = typeof result[0].start_meeting === 'string' 
        ? JSON.parse(result[0].start_meeting) 
        : result[0].start_meeting
    } catch (error) {
      // If it's not JSON, treat it as a boolean result
      startResult = { success: result[0].start_meeting }
    }

    if (!startResult.success) {
      // For validation errors (like future start time), return 422 instead of 400
      const isValidationError = startResult.message?.includes('future time') || 
                               startResult.message?.includes('already in progress') ||
                               startResult.message?.includes('not found')
      
      const statusCode = isValidationError ? 422 : 400
      return NextResponse.json({ error: startResult.message || 'Failed to start meeting' }, { status: statusCode })
    }

    // Invalidate Redis cache for meetings and status
    if (agent_user_id) {
      // Invalidate all paginated cache entries for this user
      const meetingsCachePattern = `meetings:${agent_user_id}:7:*`
      const meetingsCacheKey = `meetings:${agent_user_id}:7`
      const statusCacheKey = `meeting-status:${agent_user_id}:7`
      const countsCacheKey = `meeting-counts:${agent_user_id}:7`
      await Promise.all([
        redisCache.invalidatePattern(meetingsCachePattern),
        redisCache.del(meetingsCacheKey),
        redisCache.del(statusCacheKey),
        redisCache.del(countsCacheKey)
      ])
      console.log('✅ Meeting started and cache invalidated')
    }

    return NextResponse.json({
      success: true,
      message: 'Meeting started successfully'
    })
  } catch (error) {
    console.error('Error starting meeting:', error)
    return NextResponse.json({ error: 'Failed to start meeting' }, { status: 500 })
  }
} 