import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache } from '@/lib/redis-cache'

// POST /api/meetings/end - End a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId, agent_user_id } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    // Use the database function to end the meeting
    // The function should handle validation internally
    const query = `SELECT end_meeting($1)`
    const result = await executeQuery(query, [meetingId])

    console.log('End meeting result:', result[0])

    if (result[0]?.end_meeting === false) {
      return NextResponse.json({ 
        error: 'Failed to end meeting. Meeting may not exist or is not in progress.',
        debug: {
          meetingId
        }
      }, { status: 400 })
    }

    // Invalidate Redis cache synchronously to prevent race conditions
    if (agent_user_id) {
      try {
        // Invalidate all paginated cache entries for this user
        const meetingsCachePattern = `meetings:${agent_user_id}:7:*`
        const meetingsCacheKey = `meetings:${agent_user_id}:7`
        const statusCacheKey = `meeting-status:${agent_user_id}:7`
        
        // Wait for cache invalidation to complete
        const countsCacheKey = `meeting-counts:${agent_user_id}:7`
        await Promise.all([
          redisCache.invalidatePattern(meetingsCachePattern),
          redisCache.del(meetingsCacheKey),
          redisCache.del(statusCacheKey),
          redisCache.del(countsCacheKey)
        ])
        
        console.log('✅ Meeting ended and cache invalidated')
      } catch (error) {
        console.error('❌ Cache invalidation failed:', error)
        // Don't fail the request if cache invalidation fails
      }
    }

    // Return response after cache is invalidated
    return NextResponse.json({
      success: true,
      message: 'Meeting ended successfully'
    })
  } catch (error) {
    console.error('Error ending meeting:', error)
    return NextResponse.json({ error: 'Failed to end meeting' }, { status: 500 })
  }
} 