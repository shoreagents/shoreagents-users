import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';

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
    const validBreakTypes = ['Morning', 'Lunch', 'Afternoon'];
    if (!validBreakTypes.includes(break_type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid break_type. Must be Morning, Lunch, or Afternoon' },
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

    // Insert new break session
    const insertQuery = `
      INSERT INTO break_sessions (agent_user_id, break_type, start_time)
      VALUES ($1, $2::break_type_enum, CURRENT_TIMESTAMP)
      RETURNING id, agent_user_id, break_type, start_time, created_at
    `;

    const result = await executeQuery(insertQuery, [agent_user_id, break_type]);
    const breakSession = result[0];

    console.log(`✅ Break started: ${break_type} break for agent ${agent_user_id}`);

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
    console.error('❌ Error starting break session:', error);
    
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