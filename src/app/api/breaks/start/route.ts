import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';
import { redisCache, cacheKeys } from '@/lib/redis-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent_user_id, break_type } = body;

    // Validate required fields
    if (!agent_user_id || !break_type) {
      return NextResponse.json(
        { success: false, error: 'agent_user_id and break_type are required' },
        { status: 400 }
      );
    }

    // Validate break_type enum
    const validBreakTypes = ['Morning', 'Lunch', 'Afternoon', 'NightFirst', 'NightMeal', 'NightSecond'];
    if (!validBreakTypes.includes(break_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid break_type. Must be one of: Morning, Lunch, Afternoon, NightFirst, NightMeal, NightSecond' },
        { status: 400 }
      );
    }

    // Check if agent already has an active break
    const activeBreakQuery = `
      SELECT id, break_type, start_time 
      FROM break_sessions 
      WHERE agent_user_id = $1 AND end_time IS NULL
    `;
    
    const activeBreakResult = await executeQuery(activeBreakQuery, [agent_user_id]);
    
    if (activeBreakResult.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Agent already has an active break session',
          activeBreak: activeBreakResult[0]
        },
        { status: 409 }
      );
    }

    // Check if agent can take this break type today using database function
    const availabilityQuery = `
      SELECT can_agent_take_break($1, $2::break_type_enum) as can_take
    `;
    
    const availabilityResult = await executeQuery(availabilityQuery, [agent_user_id, break_type]);
    
    if (!availabilityResult[0]?.can_take) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Agent has already used their ${break_type} break today`,
          break_type: break_type
        },
        { status: 409 }
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

    // Get the active break configuration for this user and break type
    const breakConfigQuery = `
      SELECT id, start_time, end_time, duration_minutes
      FROM breaks 
      WHERE user_id = $1 AND break_type = $2::break_type_enum AND is_active = true
      LIMIT 1
    `;
    
    const breakConfigResult = await executeQuery(breakConfigQuery, [agent_user_id, break_type]);
    
    if (breakConfigResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active break configuration found for this break type' },
        { status: 400 }
      );
    }
    
    const breakConfig = breakConfigResult[0];

    // Insert new break session with Philippines timezone and break_config_id
    const insertQuery = `
      INSERT INTO break_sessions (agent_user_id, break_type, start_time, break_date, break_config_id)
      VALUES ($1, $2::break_type_enum, NOW(), (NOW() AT TIME ZONE 'Asia/Manila')::date, $3)
      RETURNING id, agent_user_id, break_type, start_time, break_date, break_config_id, created_at
    `;

    const result = await executeQuery(insertQuery, [agent_user_id, break_type, breakConfig.id]);
    const breakSession = result[0];

    // Invalidate break history cache for this user
    try {
      await redisCache.invalidatePattern(`breaks-history:${agent_user_id}:*`);
    } catch (cacheError) {
      console.warn('Failed to invalidate break history cache:', cacheError);
    }

    // Break started successfully;

    return NextResponse.json({
      success: true,
      message: 'Break session started successfully',
      breakSession: {
        id: breakSession.id,
        agent_user_id: breakSession.agent_user_id,
        break_type: breakSession.break_type,
        start_time: breakSession.start_time,
        created_at: breakSession.created_at
      },
      agent: agentResult[0]
    });

  } catch (error) {
    console.error('Error starting break session:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to start break session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 