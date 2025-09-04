import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// GET /api/meetings/status - Get meeting status and statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_user_id = searchParams.get('agent_user_id')
    const days = parseInt(searchParams.get('days') || '7')

    if (!agent_user_id) {
      return NextResponse.json({ error: 'agent_user_id is required' }, { status: 400 })
    }

    // Check Redis cache first
    const cacheKey = `meeting-status:${agent_user_id}:${days}`
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      // console.log('✅ Meeting status served from Redis cache') // Reduced logging
      return NextResponse.json(cachedData)
    }

    // Get meeting statistics
    const statsQuery = `SELECT * FROM get_meeting_statistics($1, $2)`
    const statsResult = await executeQuery(statsQuery, [agent_user_id, days])

    // Get active meeting if any
    const activeQuery = `SELECT * FROM get_active_meeting($1)`
    const activeResult = await executeQuery(activeQuery, [agent_user_id])

    // Check if user is in a meeting
    const inMeetingQuery = `SELECT is_user_in_meeting($1)`
    const inMeetingResult = await executeQuery(inMeetingQuery, [agent_user_id])

    const responseData = {
      success: true,
      statistics: statsResult[0] || {},
      activeMeeting: activeResult[0] || null,
      isInMeeting: inMeetingResult[0]?.is_user_in_meeting || false
    }

    // Cache the result in Redis with very short TTL for status (10 seconds)
    await redisCache.set(cacheKey, responseData, 10)
    // console.log('✅ Meeting status cached in Redis') // Reduced logging

    return NextResponse.json(responseData)
  } catch (error) {
    console.error('Error fetching meeting status:', error)
    return NextResponse.json({ error: 'Failed to fetch meeting status' }, { status: 500 })
  }
} 