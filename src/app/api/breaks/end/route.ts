import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';
import { redisCache, cacheKeys } from '@/lib/redis-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_user_id, break_id } = body;

    // Validate required fields - either agent_user_id or break_id should be provided
    if (!agent_user_id && !break_id) {
      return NextResponse.json(
        { success: false, error: 'Either agent_user_id or break_id is required' },
        { status: 400 }
      );
    }

    let updateQuery: string;
    let queryParams: any[];

    if (break_id) {
      // End specific break by ID
      updateQuery = `
        UPDATE break_sessions 
        SET end_time = NOW(),
            duration_minutes = CASE 
              WHEN pause_time IS NOT NULL AND resume_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (pause_time - start_time)) / 60 + EXTRACT(EPOCH FROM (NOW() - resume_time)) / 60
              WHEN pause_time IS NOT NULL AND resume_time IS NULL THEN 
                EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
              ELSE 
                EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
            END
        WHERE id = $1 AND end_time IS NULL
        RETURNING id, agent_user_id, break_type, start_time, end_time, duration_minutes
      `;
      queryParams = [break_id];
    } else {
      // End active break for specific agent
      updateQuery = `
        UPDATE break_sessions 
        SET end_time = NOW(),
            duration_minutes = CASE 
              WHEN pause_time IS NOT NULL AND resume_time IS NOT NULL THEN 
                EXTRACT(EPOCH FROM (pause_time - start_time)) / 60 + EXTRACT(EPOCH FROM (NOW() - resume_time)) / 60
              WHEN pause_time IS NOT NULL AND resume_time IS NULL THEN 
                EXTRACT(EPOCH FROM (pause_time - start_time)) / 60
              ELSE 
                EXTRACT(EPOCH FROM (NOW() - start_time)) / 60
            END
        WHERE agent_user_id = $1 AND end_time IS NULL
        RETURNING id, agent_user_id, break_type, start_time, end_time, duration_minutes
      `;
      queryParams = [agent_user_id];
    }

    const result = await executeQuery(updateQuery, queryParams);

    if (result.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: break_id 
            ? 'Break session not found or already ended' 
            : 'No active break session found for this agent'
        },
        { status: 404 }
      );
    }

    const completedBreak = result[0];

    // Get agent details for response
    const agentQuery = `
      SELECT u.id, u.email, pi.first_name, pi.last_name
      FROM agents a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE a.user_id = $1
    `;
    
    const agentResult = await executeQuery(agentQuery, [completedBreak.agent_user_id]);

    // Invalidate break history cache for this user
    try {
      await redisCache.invalidatePattern(`breaks-history:${completedBreak.agent_user_id}:*`);
    } catch (cacheError) {
      console.warn('Failed to invalidate break history cache:', cacheError);
    }

    // Break ended successfully;

    return NextResponse.json({
      success: true,
      message: 'Break session ended successfully',
      breakSession: {
        id: completedBreak.id,
        agent_user_id: completedBreak.agent_user_id,
        break_type: completedBreak.break_type,
        start_time: completedBreak.start_time,
        end_time: completedBreak.end_time,
        duration_minutes: Math.round(completedBreak.duration_minutes)
      },
      agent: agentResult.length > 0 ? agentResult[0] : null
    });

  } catch (error) {
    console.error('Error ending break session:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to end break session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 