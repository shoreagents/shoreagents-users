import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_user_id, time_remaining_seconds } = body;

    // Validate required fields
    if (!agent_user_id) {
      return NextResponse.json(
        { success: false, error: 'agent_user_id is required' },
        { status: 400 }
      );
    }

    if (time_remaining_seconds === undefined || time_remaining_seconds < 0) {
      return NextResponse.json(
        { success: false, error: 'time_remaining_seconds is required and must be non-negative' },
        { status: 400 }
      );
    }

    // Get active break session
    const activeBreakQuery = `
      SELECT id, break_type, start_time, pause_used, pause_time
      FROM break_sessions 
      WHERE agent_user_id = $1 AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `;
    
    const activeBreakResult = await executeQuery(activeBreakQuery, [agent_user_id]);
    
    if (activeBreakResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active break session found' },
        { status: 404 }
      );
    }

    const activeBreak = activeBreakResult[0];

    // Check if pause already used
    if (activeBreak.pause_used) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Emergency pause already used for this break session',
          break_id: activeBreak.id
        },
        { status: 409 }
      );
    }

    // Check if already paused
    if (activeBreak.pause_time) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Break session is already paused',
          break_id: activeBreak.id
        },
        { status: 409 }
      );
    }

    // Update break session with pause information (Philippines timezone)
    const pauseQuery = `
      UPDATE break_sessions 
      SET 
        pause_time = NOW() AT TIME ZONE 'Asia/Manila',
        pause_used = true,
        time_remaining_at_pause = $2
      WHERE id = $1 AND end_time IS NULL
      RETURNING id, agent_user_id, break_type, start_time, pause_time, time_remaining_at_pause
    `;

    const result = await executeQuery(pauseQuery, [activeBreak.id, time_remaining_seconds]);

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to pause break session' },
        { status: 500 }
      );
    }

    const pausedBreak = result[0];

    console.log(`⏸️ Break paused: ${pausedBreak.break_type} for agent ${agent_user_id}, ${time_remaining_seconds}s remaining`);

    return NextResponse.json({
      success: true,
      message: 'Break session paused successfully',
      breakSession: {
        id: pausedBreak.id,
        agent_user_id: pausedBreak.agent_user_id,
        break_type: pausedBreak.break_type,
        start_time: pausedBreak.start_time,
        pause_time: pausedBreak.pause_time,
        time_remaining_seconds: pausedBreak.time_remaining_at_pause,
        is_paused: true,
        pause_used: true
      }
    });

  } catch (error) {
    console.error('❌ Error pausing break session:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to pause break session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 