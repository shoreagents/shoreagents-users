import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_user_id = searchParams.get('agent_user_id');
    const days = parseInt(searchParams.get('days') || '7');
    const include_active = searchParams.get('include_active') === 'true';
    const use_date_filter = searchParams.get('use_date_filter') === 'true';

    // Validate required fields
    if (!agent_user_id) {
      return NextResponse.json(
        { success: false, error: 'agent_user_id is required' },
        { status: 400 }
      );
    }

    // Check Redis cache first
    const cacheKey = cacheKeys.breaksHistory(agent_user_id, days, include_active)
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Verify agent exists
    const agentCheckQuery = `
      SELECT u.id, u.email, pi.first_name, pi.last_name
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE a.user_id = $1
    `;
    
    const agentResult = await executeQuery(agentCheckQuery, [agent_user_id]);
    
    if (agentResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Get break history - for recent sessions, get last 5 regardless of date
    // For full history, use date filtering
    const historyQuery = use_date_filter ? `
      SELECT 
        id,
        agent_user_id,
        break_type,
        start_time,
        end_time,
        pause_time,
        resume_time,
        pause_used,
        time_remaining_at_pause,
        duration_minutes,
        break_date,
        created_at,
        is_expired,
        is_break_session_expired(id) as is_expired_check
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND start_time >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '${days} days'
      ${!include_active ? 'AND end_time IS NOT NULL' : ''}
      ORDER BY start_time DESC
    ` : `
      SELECT 
        id,
        agent_user_id,
        break_type,
        start_time,
        end_time,
        pause_time,
        resume_time,
        pause_used,
        time_remaining_at_pause,
        duration_minutes,
        break_date,
        created_at,
        is_expired,
        is_break_session_expired(id) as is_expired_check
      FROM break_sessions 
      WHERE agent_user_id = $1 
      ${!include_active ? 'AND end_time IS NOT NULL' : ''}
      ORDER BY start_time DESC
      LIMIT 10
    `;

    const historyResult = await executeQuery(historyQuery, [agent_user_id]);

    // Separate active and completed breaks
    const activeBreaks = historyResult.filter(session => session.end_time === null);
    const completedBreaks = historyResult.filter(session => session.end_time !== null);

    // Get break statistics (including active breaks with calculated duration)
    const statsQuery = `
      SELECT 
        break_type,
        COUNT(*) as total_sessions,
        ROUND(AVG(
          CASE 
            WHEN end_time IS NOT NULL THEN duration_minutes
            WHEN pause_time IS NOT NULL THEN EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
            ELSE EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
          END
        )::numeric, 1) as avg_duration,
        SUM(
          CASE 
            WHEN end_time IS NOT NULL THEN duration_minutes
            WHEN pause_time IS NOT NULL THEN EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
            ELSE EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
          END
        ) as total_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND start_time >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY break_type
      ORDER BY break_type
    `;

    const statsResult = await executeQuery(statsQuery, [agent_user_id]);

    // Get today's breaks
    const todayQuery = `
      SELECT 
        id,
        break_type,
        start_time,
        end_time,
        duration_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND DATE(start_time) = CURRENT_DATE
      ORDER BY start_time
    `;

    const todayResult = await executeQuery(todayQuery, [agent_user_id]);

    // Calculate total break time from ALL history (not just today)
    const totalBreakTimeQuery = `
      SELECT 
        SUM(
          CASE 
            WHEN end_time IS NOT NULL THEN duration_minutes
            WHEN pause_time IS NOT NULL THEN EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
            ELSE EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
          END
        ) as total_break_time_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND end_time IS NOT NULL
    `;

    const totalBreakTimeResult = await executeQuery(totalBreakTimeQuery, [agent_user_id]);
    const totalBreakTimeMinutes = totalBreakTimeResult[0]?.total_break_time_minutes || 0;

    // Break history retrieved;

    const responseData = {
      success: true,
      agent: agentResult[0],
      data: {
        active_breaks: activeBreaks,
        completed_breaks: completedBreaks,
        today_breaks: todayResult,
        statistics: statsResult,
        summary: {
          total_sessions: historyResult.length,
          active_sessions: activeBreaks.length,
          completed_sessions: completedBreaks.length,
          today_sessions: todayResult.length,
          date_range: `${days} days`,
          total_break_time: statsResult.reduce((sum, stat) => sum + (stat.total_minutes || 0), 0),
          // Calculate total time from ALL break history (not just today)
          total_time: totalBreakTimeMinutes,
          today_break_time: todayResult.reduce((sum, session) => sum + (session.duration_minutes || 0), 0)
        }
      }
    }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.breaksHistory)

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Error fetching break history:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch break history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 

