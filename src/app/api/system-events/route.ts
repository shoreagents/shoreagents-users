import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// Database configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000,
};

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth');
  if (!authCookie) return null;

  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : '';
    const decoded = decodeURIComponent(raw);
    const authData = JSON.parse(decoded);
    if (!authData.isAuthenticated || !authData.user) return null;

    return {
      id: authData.user.railway_id || authData.user.id,
      email: authData.user.email,
      name: authData.user.name,
    };
  } catch (error) {
    console.error('Error parsing auth cookie:', error);
    return null;
  }
}

// POST: Record system event (suspend/resume/lock/unlock)
export async function POST(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventType, sessionId, metadata } = body;

    if (!eventType || !['suspend', 'resume', 'lock', 'unlock'].includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type. Must be: suspend, resume, lock, or unlock' },
        { status: 400 }
      );
    }

    pool = new Pool(databaseConfig);
    const client = await pool.connect();

    try {
      // Set timezone to Philippines
      await client.query('SET TIME ZONE \'Asia/Manila\'');
      
      // Check if there's an existing active session for this user
      const existingSessionQuery = `
        SELECT id, event_type, session_id 
        FROM system_events 
        WHERE user_id = $1 
        AND session_id = $2 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      
      const existingResult = await client.query(existingSessionQuery, [user.id, sessionId || null]);
      
      let result;
      
      if (existingResult.rows.length > 0) {
        // Update existing row with new event type
        result = await client.query(`
          UPDATE system_events 
          SET event_type = $1, event_timestamp = NOW(), metadata = $2, updated_at = NOW()
          WHERE id = $3
          RETURNING id, event_timestamp
        `, [eventType, metadata || null, existingResult.rows[0].id]);
        
        console.log(`✅ System event updated: ${eventType} for user ${user.email} (session: ${sessionId})`);
      } else {
        // Create new row
        result = await client.query(`
          INSERT INTO system_events (user_id, event_type, session_id, metadata)
          VALUES ($1, $2, $3, $4)
          RETURNING id, event_timestamp
        `, [user.id, eventType, sessionId || null, metadata || null]);
        
        console.log(`✅ System event created: ${eventType} for user ${user.email} (session: ${sessionId})`);
      }

      return NextResponse.json({
        success: true,
        eventId: result.rows[0].id,
        timestamp: result.rows[0].event_timestamp,
        isUpdate: existingResult.rows.length > 0
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error recording system event:', error);
    return NextResponse.json(
      { error: 'Failed to record system event' },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// GET: Retrieve system events for user
export async function GET(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const eventType = searchParams.get('eventType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    pool = new Pool(databaseConfig);
    const client = await pool.connect();

    try {
      // Set timezone to Philippines
      await client.query('SET TIME ZONE \'Asia/Manila\'');
      
      let query = `
        SELECT id, event_type, event_timestamp, session_id, metadata
        FROM system_events 
        WHERE user_id = $1
      `;
      const params: any[] = [user.id];
      let paramCount = 1;

      if (eventType) {
        paramCount++;
        query += ` AND event_type = $${paramCount}`;
        params.push(eventType);
      }

      if (startDate) {
        paramCount++;
        query += ` AND event_timestamp >= $${paramCount}`;
        params.push(startDate);
      }

      if (endDate) {
        paramCount++;
        query += ` AND event_timestamp <= $${paramCount}`;
        params.push(endDate);
      }

      query += ` ORDER BY event_timestamp DESC LIMIT $${paramCount + 1}`;
      params.push(limit);

      const result = await client.query(query, params);

      return NextResponse.json({
        success: true,
        events: result.rows,
        total: result.rows.length
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error fetching system events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system events' },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// GET: Get suspend/resume statistics for user
export async function PUT(request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    pool = new Pool(databaseConfig);
    const client = await pool.connect();

    try {
      // Set timezone to Philippines
      await client.query('SET TIME ZONE \'Asia/Manila\'');
      
      const result = await client.query(`
        SELECT * FROM get_user_suspend_stats($1, $2::DATE)
      `, [user.id, date]);

      const stats = result.rows[0] || {
        total_suspend_events: 0,
        total_resume_events: 0,
        total_lock_events: 0,
        total_unlock_events: 0,
        first_suspend_time: null,
        last_resume_time: null,
        total_suspend_duration_seconds: 0
      };

      return NextResponse.json({
        success: true,
        stats
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error fetching suspend stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suspend statistics' },
      { status: 500 }
    );
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
