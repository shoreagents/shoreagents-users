import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// GET /api/meetings - Get user's meetings with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_user_id = searchParams.get('agent_user_id')
    const days = parseInt(searchParams.get('days') || '7')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!agent_user_id) {
      return NextResponse.json({ error: 'agent_user_id is required' }, { status: 400 })
    }

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      return NextResponse.json({ error: 'limit must be between 1 and 1000' }, { status: 400 })
    }
    if (offset < 0) {
      return NextResponse.json({ error: 'offset must be non-negative' }, { status: 400 })
    }

    // Check Redis cache first (include pagination in cache key)
    const cacheKey = cacheKeys.meetings(agent_user_id, days, limit, offset)
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get paginated meetings
    const query = `SELECT * FROM get_user_meetings($1, $2, $3, $4)`
    const result = await executeQuery(query, [agent_user_id, days, limit, offset])

    // Get total count for pagination info
    const countQuery = `SELECT get_user_meetings_count($1, $2) as total_count`
    const countResult = await executeQuery(countQuery, [agent_user_id, days])
    const totalCount = countResult[0]?.total_count || 0

    // Convert timestamps to proper timezone format
    // The database returns timestamps with timezone info, so we need to parse them correctly
    const meetingsWithTimezone = result.map(meeting => ({
      ...meeting,
      start_time: meeting.start_time ? new Date(meeting.start_time).toISOString() : null,
      end_time: meeting.end_time ? new Date(meeting.end_time).toISOString() : null,
      created_at: meeting.created_at ? new Date(meeting.created_at).toISOString() : null
    }))

    const responseData = {
      success: true,
      meetings: meetingsWithTimezone,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    }

    // Cache the result in Redis with shorter TTL for more responsive updates
    await redisCache.set(cacheKey, responseData, 30)

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

// POST /api/meetings - Create a new meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_user_id, title, description, type, scheduledTime } = body

    // Validate required fields
    if (!agent_user_id || !title || !type) {
      return NextResponse.json({ error: 'agent_user_id, title, and type are required' }, { status: 400 })
    }

    // Use scheduled time if provided, otherwise use current time
    const startTime = scheduledTime ? new Date(scheduledTime).toISOString() : new Date().toISOString()
    const isImmediateMeeting = !scheduledTime

    const query = `
      INSERT INTO meetings (agent_user_id, title, description, start_time, end_time, duration_minutes, meeting_type, status, is_in_meeting)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `

    const result = await executeQuery(query, [
      agent_user_id,
      title,
      description || '',
      startTime,
      null, // end_time is NULL for open-ended meetings
      0, // duration_minutes is 0 initially, will be calculated when meeting ends
      type,
      isImmediateMeeting ? 'in-progress' : 'scheduled',
      isImmediateMeeting // is_in_meeting is true for immediate meetings
    ])

    // Invalidate Redis cache for this user's meetings
    // Invalidate all paginated cache entries for this user
    const meetingsCachePattern = `meetings:${agent_user_id}:7:*`
    await redisCache.invalidatePattern(meetingsCachePattern)
    
    // Also invalidate the base cache key
    const cacheKey = cacheKeys.meetings(agent_user_id, 7)
    await redisCache.del(cacheKey)
    
    // Also invalidate status cache
    const statusCacheKey = `meeting-status:${agent_user_id}:7`
    await redisCache.del(statusCacheKey)
    
    // Also invalidate counts cache
    const countsCacheKey = `meeting-counts:${agent_user_id}:7`
    await redisCache.del(countsCacheKey)
    
    return NextResponse.json({
      success: true,
      meeting: result[0]
    })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
} 