import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_user_id = searchParams.get('agent_user_id');
    const days = parseInt(searchParams.get('days') || '7');
    const include_active = searchParams.get('include_active') === 'true';

    // Validate required fields
    if (!agent_user_id) {
      return NextResponse.json(
        { success: false, error: 'agent_user_id is required' },
        { status: 400 }
      );
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

    // Get break history using break_date column
    const historyQuery = `
      SELECT 
        id,
        agent_user_id,
        break_type,
        start_time,
        end_time,
        duration_minutes,
        break_date,
        created_at
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND break_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '${days} days'
      ${!include_active ? 'AND end_time IS NOT NULL' : ''}
      ORDER BY start_time DESC
    `;

    const historyResult = await executeQuery(historyQuery, [agent_user_id]);

    // Separate active and completed breaks
    const activeBreaks = historyResult.filter(session => session.end_time === null);
    const completedBreaks = historyResult.filter(session => session.end_time !== null);

    // Get break statistics
    const statsQuery = `
      SELECT 
        break_type,
        COUNT(*) as total_sessions,
        ROUND(AVG(duration_minutes)::numeric, 1) as avg_duration,
        SUM(duration_minutes) as total_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND end_time IS NOT NULL
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

    console.log(`📊 Break history retrieved for agent ${agent_user_id}: ${historyResult.length} sessions in last ${days} days`);

    return NextResponse.json({
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
          total_break_time: statsResult.reduce((sum, stat) => sum + (stat.total_minutes || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching break history:', error);
    
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