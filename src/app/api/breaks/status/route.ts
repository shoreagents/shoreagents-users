import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent_user_id = searchParams.get('agent_user_id');

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

    // Get active break (including paused breaks)
    const activeBreakQuery = `
      SELECT 
        id,
        agent_user_id,
        break_type,
        start_time,
        pause_time,
        resume_time,
        pause_used,
        time_remaining_at_pause,
        created_at,
        CASE 
          WHEN pause_time IS NOT NULL AND resume_time IS NULL THEN time_remaining_at_pause
          WHEN pause_time IS NOT NULL AND resume_time IS NOT NULL THEN 
            EXTRACT(EPOCH FROM ((NOW()) - resume_time)) / 60
          ELSE EXTRACT(EPOCH FROM ((NOW()) - start_time)) / 60
        END as current_duration_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 AND end_time IS NULL
      ORDER BY start_time DESC
      LIMIT 1
    `;

    const activeBreakResult = await executeQuery(activeBreakQuery, [agent_user_id]);
    const activeBreak = activeBreakResult.length > 0 ? activeBreakResult[0] : null;

    // Get today's completed breaks using break_date column
    const todayBreaksQuery = `
      SELECT 
        id,
        break_type,
        start_time,
        end_time,
        duration_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
      AND end_time IS NOT NULL
      ORDER BY start_time
    `;

    const todayBreaksResult = await executeQuery(todayBreaksQuery, [agent_user_id]);

    // Get break availability using the new database function
    const breakAvailabilityQuery = `
      SELECT * FROM get_agent_daily_breaks($1)
    `;
    
    const availabilityResult = await executeQuery(breakAvailabilityQuery, [agent_user_id]);

    // Calculate today's break summary using database function results
    const todaySummary = {
      total_breaks: todayBreaksResult.length + (activeBreak ? 1 : 0),
      completed_breaks: todayBreaksResult.length,
      total_minutes: todayBreaksResult.reduce((sum, b) => sum + (b.duration_minutes || 0), 0),
      breaks_by_type: {
        Morning: availabilityResult.find(r => r.break_type === 'Morning')?.break_count || 0,
        Lunch: availabilityResult.find(r => r.break_type === 'Lunch')?.break_count || 0,
        Afternoon: availabilityResult.find(r => r.break_type === 'Afternoon')?.break_count || 0
      },
      break_availability: {
        Morning: availabilityResult.find(r => r.break_type === 'Morning')?.can_take_break ?? true,
        Lunch: availabilityResult.find(r => r.break_type === 'Lunch')?.can_take_break ?? true,
        Afternoon: availabilityResult.find(r => r.break_type === 'Afternoon')?.can_take_break ?? true
      }
    };

    // Calculate current break duration and pause status if active
    if (activeBreak) {
      activeBreak.current_duration_minutes = Math.round(activeBreak.current_duration_minutes);
      activeBreak.is_paused = activeBreak.pause_time !== null && activeBreak.resume_time === null;
      activeBreak.can_pause = !activeBreak.pause_used;
    }

    // Break status retrieved;

    return NextResponse.json({
      success: true,
      agent: agentResult[0],
      status: {
        is_on_break: !!activeBreak,
        active_break: activeBreak,
        today_summary: todaySummary,
        today_breaks: todayBreaksResult
      }
    });

  } catch (error) {
    console.error('❌ Error fetching break status:', error);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch break status';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        errorMessage = 'Database tables not found. Please run database migrations first.';
        statusCode = 503;
      } else if (error.message.includes('connect')) {
        errorMessage = 'Database connection failed. Please check DATABASE_URL configuration.';
        statusCode = 503;
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: statusCode }
    );
  }
} 