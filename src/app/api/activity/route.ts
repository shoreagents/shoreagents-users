import { NextRequest, NextResponse } from 'next/server';
import { Pool, Client } from 'pg';

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create a single pool instance that persists across requests
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool(databaseConfig);
  }
  return pool;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const realtime = searchParams.get('realtime') === 'true';
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }

    // If realtime is requested, set up Server-Sent Events
    if (realtime) {
      return handleRealtimeRequest(request, email, userId);
    }
    
    // Regular GET request - get current day's activity (Philippines timezone)
    let query = 'SELECT ad.*, u.email FROM activity_data ad JOIN users u ON ad.user_id = u.id WHERE ad.today_date = (NOW() AT TIME ZONE \'Asia/Manila\')::date';
    let params: any[] = [];
    
    if (userId) {
      query += ' AND ad.user_id = $1';
      params.push(userId);
    } else if (email) {
      query += ' AND u.email = $1';
      params.push(email);
    }
    
    const pool = getPool();
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Activity data not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching activity data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleRealtimeRequest(request: NextRequest, email: string | null, userId: string | null) {
  try {
    const pool = getPool();
    let actualUserId: number;

    if (userId) {
      actualUserId = parseInt(userId);
    } else if (email) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actualUserId = userResult.rows[0].id;
    } else {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }

    // Set up Server-Sent Events headers
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', message: 'Real-time connection established' })}\n\n`));

        // Connect to PostgreSQL and listen for notifications
        const client = new Client(databaseConfig);
        
        client.connect().then(() => {
          // Listen for activity change notifications
          client.query('LISTEN activity_change');
          
          // Handle notifications
          client.on('notification', (msg: any) => {
            try {
              const data = JSON.parse(msg.payload);
              
              // Only send notifications for the specific user
              if (data.user_id === actualUserId) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'activity_change',
                  data: {
                    user_id: data.user_id,
                    is_currently_active: data.is_currently_active,
                    updated_at: data.updated_at
                  }
                })}\n\n`));
              }
            } catch (error) {
              // Silent error handling
            }
          });

          // Handle client disconnect
          request.signal.addEventListener('abort', () => {
            client.query('UNLISTEN activity_change');
            client.end();
          });
        }).catch(error => {
          console.error('Database connection error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Database connection failed' })}\n\n`));
          controller.close();
        });
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    console.error('Error setting up real-time connection:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get database connection
    const pool = getPool();
    
    const body = await request.json();
    const { userId, email, isCurrentlyActive } = body;
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }
    
    let actualUserId = userId;
    
    // If email provided, get user ID
    if (email && !userId) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actualUserId = userResult.rows[0].id;
    }
    
    // Get or create activity data for current day (Philippines timezone)
    const existingResult = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND today_date = (NOW() AT TIME ZONE \'Asia/Manila\')::date', 
      [actualUserId]
    );
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      
      // Only update if state is changing
      if (existing.is_currently_active !== isCurrentlyActive) {
        // Use database function to calculate time difference safely
        const timeDiffResult = await pool.query(
          'SELECT calculate_time_diff($1) as seconds_diff',
          [existing.updated_at]
        );
        const secondsDiff = timeDiffResult.rows[0].seconds_diff;
        
        // Get current values (handle missing columns gracefully)
        const currentActiveSeconds = existing.today_active_seconds || 0;
        const currentInactiveSeconds = existing.today_inactive_seconds || 0;
        
        let newActiveSeconds = currentActiveSeconds;
        let newInactiveSeconds = currentInactiveSeconds;
        let sessionStart = existing.last_session_start;
        
        if (existing.is_currently_active) {
          // Was active, now inactive - add to active time
          newActiveSeconds += secondsDiff;
        } else {
          // Was inactive, now active - add to inactive time and start new session
          newInactiveSeconds += secondsDiff;
          sessionStart = new Date(); // Use application time for session start
        }
        
        // Update existing record with time tracking for current day (Philippines timezone)
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET is_currently_active = $1, 
               today_active_seconds = $2, 
               today_inactive_seconds = $3, 
               last_session_start = $4, 
               updated_at = NOW() 
           WHERE user_id = $5 AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
           RETURNING *`,
          [isCurrentlyActive, newActiveSeconds, newInactiveSeconds, sessionStart, actualUserId]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      } else {
        // State hasn't changed, just update the timestamp
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET updated_at = NOW() 
           WHERE user_id = $1 AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
           RETURNING *`,
          [actualUserId]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      }
    } else {
      // Create new record for current day (Philippines timezone)
      const now = new Date();
      const sessionStart = isCurrentlyActive ? now : null;
      
      const insertResult = await pool.query(
        `INSERT INTO activity_data 
         (user_id, is_currently_active, last_session_start, today_date) 
         VALUES ($1, $2, $3, (NOW() AT TIME ZONE 'Asia/Manila')::date) 
         RETURNING *`,
        [actualUserId, isCurrentlyActive, sessionStart]
      );
      
      return NextResponse.json(insertResult.rows[0], { status: 201 });
    }
  } catch (error) {
    console.error('Error creating/updating activity data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const pool = getPool();
    
    const body = await request.json();
    const { userId, email, frontendActiveSeconds, frontendInactiveSeconds } = body;
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email is required' }, { status: 400 });
    }
    
    let actualUserId = userId;
    
    // If email provided, get user ID
    if (email && !userId) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actualUserId = userResult.rows[0].id;
    }
    
    console.log('Actual user ID:', actualUserId);
    
    // Get current activity data for today (Philippines timezone)
    const existingResult = await pool.query(
      'SELECT * FROM activity_data WHERE user_id = $1 AND today_date = (NOW() AT TIME ZONE \'Asia/Manila\')::date', 
      [actualUserId]
    );
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0];
      
      // If frontend values are provided, use them directly
      if (frontendActiveSeconds !== undefined || frontendInactiveSeconds !== undefined) {
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET today_active_seconds = $1, 
               today_inactive_seconds = $2, 
               updated_at = NOW() 
           WHERE user_id = $3 AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
           RETURNING *`,
          [frontendActiveSeconds || 0, frontendInactiveSeconds || 0, actualUserId]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      }
      
      // Fallback: Try to use database function, fallback to manual calculation
      let secondsDiff = 0;
      try {
        const timeDiffResult = await pool.query(
          'SELECT calculate_time_diff($1) as seconds_diff',
          [existing.updated_at]
        );
        secondsDiff = timeDiffResult.rows[0].seconds_diff;
      } catch (error) {
        // Fallback: manual time calculation
        const now = new Date();
        const lastUpdate = new Date(existing.updated_at);
        secondsDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
        secondsDiff = Math.max(0, secondsDiff); // Ensure positive
      }
      
      // Always update if we have time to add
      if (secondsDiff > 0) {
        // Get current values
        const currentActiveSeconds = existing.today_active_seconds || 0;
        const currentInactiveSeconds = existing.today_inactive_seconds || 0;
        
        let newActiveSeconds = currentActiveSeconds;
        let newInactiveSeconds = currentInactiveSeconds;
        
        if (existing.is_currently_active) {
          // Currently active - add to active time
          newActiveSeconds += secondsDiff;
        } else {
          // Currently inactive - add to inactive time
          newInactiveSeconds += secondsDiff;
        }
        
                // Update the record with accumulated time for current day (Philippines timezone)
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET today_active_seconds = $1, 
               today_inactive_seconds = $2, 
               updated_at = NOW() 
           WHERE user_id = $3 AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
           RETURNING *`,
          [newActiveSeconds, newInactiveSeconds, actualUserId]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      } else {
        // No time to add, just update timestamp
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET updated_at = NOW() 
           WHERE user_id = $1 AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
           RETURNING *`,
          [actualUserId]
        );
        return NextResponse.json(updateResult.rows[0]);
      }
    } else {
      return NextResponse.json({ error: 'Activity data not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating activity time:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 