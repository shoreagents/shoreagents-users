import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache } from '@/lib/redis-cache'

// POST /api/meetings/cancel - Cancel a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId, agent_user_id } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    // Use the database function to cancel the meeting
    const query = `SELECT cancel_meeting($1)`
    const result = await executeQuery(query, [meetingId])

    if (result[0]?.cancel_meeting === false) {
      return NextResponse.json({ error: 'Failed to cancel meeting. Meeting may not exist or is not in scheduled status.' }, { status: 400 })
    }

    // Invalidate Redis cache for meetings and status
    if (agent_user_id) {
      const meetingsCacheKey = `meetings:${agent_user_id}:7`
      const statusCacheKey = `meeting-status:${agent_user_id}:7`
      await Promise.all([
        redisCache.del(meetingsCacheKey),
        redisCache.del(statusCacheKey)
      ])
      console.log('✅ Meeting cancelled and cache invalidated')
    }

    return NextResponse.json({
      success: true,
      message: 'Meeting cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling meeting:', error)
    return NextResponse.json({ error: 'Failed to cancel meeting' }, { status: 500 })
  }
} 