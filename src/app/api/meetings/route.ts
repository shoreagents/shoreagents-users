import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// GET /api/meetings - Get user's meetings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_user_id = searchParams.get('agent_user_id')
    const days = parseInt(searchParams.get('days') || '7')

    if (!agent_user_id) {
      return NextResponse.json({ error: 'agent_user_id is required' }, { status: 400 })
    }

    // Check Redis cache first
    const cacheKey = cacheKeys.meetings(agent_user_id, days)
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      console.log('✅ Meetings served from Redis cache')
      return NextResponse.json(cachedData)
    }

    const query = `SELECT * FROM get_user_meetings($1, $2)`
    const result = await executeQuery(query, [agent_user_id, days])

    const responseData = {
      success: true,
      meetings: result
    }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.meetings)
    console.log('✅ Meetings cached in Redis')

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

    const query = `
      INSERT INTO meetings (agent_user_id, title, description, start_time, end_time, duration_minutes, meeting_type, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      'scheduled'
    ])

    // Invalidate Redis cache for this user's meetings
    const cacheKey = cacheKeys.meetings(agent_user_id, 7)
    await redisCache.del(cacheKey)
    
    // Also invalidate status cache
    const statusCacheKey = `meeting-status:${agent_user_id}:7`
    await redisCache.del(statusCacheKey)
    
    console.log('✅ Meeting created and cache invalidated')

    return NextResponse.json({
      success: true,
      meeting: result[0]
    })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
} 