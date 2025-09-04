import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// GET /api/meetings/counts - Get meeting counts for tabs
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Counts API called')
    const { searchParams } = new URL(request.url)
    const agent_user_id = searchParams.get('agent_user_id')
    const days = parseInt(searchParams.get('days') || '7')

    console.log('📊 Counts API params:', { agent_user_id, days })

    if (!agent_user_id) {
      console.log('❌ Missing agent_user_id')
      return NextResponse.json({ error: 'agent_user_id is required' }, { status: 400 })
    }

    // Check Redis cache first
    const cacheKey = `meeting-counts:${agent_user_id}:${days}`
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get counts for different categories
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    // Total count - use the same logic as get_user_meetings function
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM meetings m
      WHERE m.agent_user_id = $1
      AND m.start_time >= NOW() - INTERVAL '1 day' * $2
    `

    // Today's meetings count
    const todayQuery = `
      SELECT COUNT(*) as today_count
      FROM meetings m
      WHERE m.agent_user_id = $1
      AND m.start_time >= $2
      AND m.start_time < $3
    `

    // Scheduled meetings count - include all scheduled meetings regardless of start time
    const scheduledQuery = `
      SELECT COUNT(*) as scheduled_count
      FROM meetings m
      WHERE m.agent_user_id = $1
      AND m.status = 'scheduled'
    `

    // In-progress meetings count - use start_time for consistency
    const inProgressQuery = `
      SELECT COUNT(*) as in_progress_count
      FROM meetings m
      WHERE m.agent_user_id = $1
      AND m.start_time >= NOW() - INTERVAL '1 day' * $2
      AND m.status = 'in-progress'
    `

    // Completed meetings count - use start_time for consistency
    const completedQuery = `
      SELECT COUNT(*) as completed_count
      FROM meetings m
      WHERE m.agent_user_id = $1
      AND m.start_time >= NOW() - INTERVAL '1 day' * $2
      AND m.status = 'completed'
    `

    // Execute all queries in parallel
    const [
      totalResult,
      todayResult,
      scheduledResult,
      inProgressResult,
      completedResult
    ] = await Promise.all([
      executeQuery(totalQuery, [agent_user_id, days]),
      executeQuery(todayQuery, [agent_user_id, todayStart.toISOString(), todayEnd.toISOString()]),
      executeQuery(scheduledQuery, [agent_user_id]), // Only pass agent_user_id for scheduled query
      executeQuery(inProgressQuery, [agent_user_id, days]),
      executeQuery(completedQuery, [agent_user_id, days])
    ])

    const counts = {
      total: totalResult[0]?.total || 0,
      today: todayResult[0]?.today_count || 0,
      scheduled: scheduledResult[0]?.scheduled_count || 0,
      inProgress: inProgressResult[0]?.in_progress_count || 0,
      completed: completedResult[0]?.completed_count || 0
    }

    console.log('📈 Counts result:', counts)

    // Cache the result
    await redisCache.set(cacheKey, counts, 60) // 1 minute cache

    console.log('✅ Counts API returning:', counts)
    return NextResponse.json(counts)
  } catch (error) {
    console.error('❌ Error fetching meeting counts:', error)
    return NextResponse.json({ error: 'Failed to fetch meeting counts' }, { status: 500 })
  }
}
