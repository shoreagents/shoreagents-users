import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache } from '@/lib/redis-cache'

// POST /api/meetings/start - Start a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId, agent_user_id } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    if (!agent_user_id) {
      return NextResponse.json({ error: 'Agent user ID is required' }, { status: 400 })
    }

    // Use the database function to start the meeting with proper validation
    const query = `SELECT start_meeting($1, $2)`
    const result = await executeQuery(query, [meetingId, agent_user_id])

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
      const meetingsCacheKey = `meetings:${agent_user_id}:7`
      const statusCacheKey = `meeting-status:${agent_user_id}:7`
      await Promise.all([
        redisCache.del(meetingsCacheKey),
        redisCache.del(statusCacheKey)
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