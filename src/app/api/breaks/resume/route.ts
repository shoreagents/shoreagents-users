import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_user_id } = body;

    // Validate required fields
    if (!agent_user_id) {
      return NextResponse.json(
        { success: false, error: 'agent_user_id is required' },
        { status: 400 }
      );
    }

    // Get paused break session
    const pausedBreakQuery = `
      SELECT id, break_type, start_time, pause_time, time_remaining_at_pause, pause_used
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND end_time IS NULL 
      AND pause_time IS NOT NULL 
      AND resume_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `;
    
    const pausedBreakResult = await executeQuery(pausedBreakQuery, [agent_user_id]);
    
    if (pausedBreakResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No paused break session found' },
        { status: 404 }
      );
    }

    const pausedBreak = pausedBreakResult[0];

    // Update break session with resume time (Philippines timezone)
    const resumeQuery = `
      UPDATE break_sessions 
      SET resume_time = NOW() AT TIME ZONE 'Asia/Manila'
      WHERE id = $1 AND end_time IS NULL AND pause_time IS NOT NULL AND resume_time IS NULL
      RETURNING id, agent_user_id, break_type, start_time, pause_time, resume_time, time_remaining_at_pause
    `;

    const result = await executeQuery(resumeQuery, [pausedBreak.id]);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to resume break session' },
        { status: 500 }
      );
    }

    const resumedBreak = result[0];

;

    return NextResponse.json({
      success: true,
      message: 'Break session resumed successfully',
      breakSession: {
        id: resumedBreak.id,
        agent_user_id: resumedBreak.agent_user_id,
        break_type: resumedBreak.break_type,
        start_time: resumedBreak.start_time,
        pause_time: resumedBreak.pause_time,
        resume_time: resumedBreak.resume_time,
        time_remaining_seconds: resumedBreak.time_remaining_at_pause,
        is_paused: false,
        pause_used: true
      }
    });

  } catch (error) {
    console.error('❌ Error resuming break session:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to resume break session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 