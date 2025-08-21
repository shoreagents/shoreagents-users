import { NextRequest, NextResponse } from 'next/server';
import { Pool, Client } from 'pg';
import { parseShiftTime } from '../../../lib/shift-utils';

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

// Resolve user ID from either explicit userId or email
async function resolveUserId(pool: Pool, userId: string | null, email: string | null): Promise<number | null> {
  if (userId) return parseInt(userId);
  if (!email) return null;
  const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (userResult.rows.length === 0) return null;
  return userResult.rows[0].id as number;
}

// Get user's shift start time as 24h string (HH:MM) from job_info; fallback to 06:00 if missing
async function getUserShiftStartTime(pool: Pool, actualUserId: number): Promise<string> {
  try {
    const result = await pool.query(
      `SELECT ji.shift_time
       FROM job_info ji
       WHERE (ji.agent_user_id = $1 OR ji.internal_user_id = $1)
         AND ji.shift_time IS NOT NULL
       ORDER BY ji.id DESC
       LIMIT 1`,
      [actualUserId]
    );
    if (result.rows.length > 0) {
      const shiftTimeStr = result.rows[0].shift_time as string;
      const info = parseShiftTime(shiftTimeStr);
      if (info && info.startTime) {
        const hh = String(info.startTime.getHours()).padStart(2, '0');
        const mm = String(info.startTime.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
      }
    }
  } catch (_) {
    // ignore and use default
  }
  return '06:00';
}

// NEW: Use the database function to get the correct activity date for any shift
async function getActivityDateForShift(pool: Pool, actualUserId: number): Promise<string> {
  try {
    const result = await pool.query(
      'SELECT get_activity_date_for_shift_simple($1) as activity_date',
      [actualUserId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].activity_date;
    }
  } catch (error) {
    console.error('Error getting activity date for shift:', error);
  }
  
  // Fallback to old logic if function fails
  const shiftStart = await getUserShiftStartTime(pool, actualUserId);
  const now = new Date();
  const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
  const currentTime = philippinesTime.toTimeString().slice(0, 5); // HH:MM format
  
  // Parse shift start time
  const [shiftHour, shiftMinute] = shiftStart.split(':').map(Number);
  const shiftStartMinutes = shiftHour * 60 + shiftMinute;
  const [currentHour, currentMinute] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;
  
  // Calculate effective date: if we're before shift start, use previous day
  let effectiveDate = philippinesTime;
  if (currentMinutes < shiftStartMinutes) {
    effectiveDate.setDate(effectiveDate.getDate() - 1);
  }
  
  return effectiveDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

// NEW: Use the database function to check if we should reset activity
async function shouldResetActivity(pool: Pool, actualUserId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT should_reset_activity_simple($1) as should_reset',
      [actualUserId]
    );
    if (result.rows.length > 0) {
      return result.rows[0].should_reset;
    }
  } catch (error) {
    console.error('Error checking if should reset activity:', error);
  }
  
  // Fallback to old logic if function fails
  return true;
}

// Check if we're starting a new shift period (not just a new day)
async function isNewShiftPeriod(pool: Pool, actualUserId: number, effectiveDateStr: string): Promise<boolean> {
  try {
    // Get the most recent activity data for this user
    const recentResult = await pool.query(
      `SELECT today_date, updated_at, is_currently_active
       FROM activity_data 
       WHERE user_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [actualUserId]
    );
    
    if (recentResult.rows.length === 0) {
      // No previous data, this is definitely a new shift
      return true;
    }
    
    const mostRecent = recentResult.rows[0];
    
    // If the most recent data is from a different date, this is a new shift
    if (mostRecent.today_date !== effectiveDateStr) {
      return true;
    }
    
    // If the most recent data is from the same date, check if we're starting fresh
    // (e.g., user just logged in after shift ended)
    const now = new Date();
    const lastUpdate = new Date(mostRecent.updated_at);
    const hoursSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
    
    // If more than 2 hours have passed since last update, consider it a new shift
    // This handles cases where user logs in after a long break
    if (hoursSinceLastUpdate > 2) {
      return true;
    }
    
    // If user was inactive and is now becoming active, this might be a new session
    // but not necessarily a new shift
    if (!mostRecent.is_currently_active) {
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if new shift period:', error);
    // Default to creating new row if there's an error
    return true;
  }
}

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
    
    // Regular GET request - use new night shift logic
    const pool = getPool();
    const actualUserId = await resolveUserId(pool, userId, email);
    if (!actualUserId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // NEW: Use the database function to get the correct activity date
    const effectiveDateStr = await getActivityDateForShift(pool, actualUserId);

    const query = `
      SELECT ad.*, u.email
      FROM activity_data ad
      JOIN users u ON ad.user_id = u.id
      WHERE ad.user_id = $1 AND ad.today_date = $2`;

    // Fetch using the correct activity date
    let result = await pool.query(query, [actualUserId, effectiveDateStr]);

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
    const resolved = await resolveUserId(pool, userId, email);
    if (!resolved) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const actualUserId: number = resolved;

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
    
      // NEW: Use the database function to get the correct activity date
    const effectiveDateStr = await getActivityDateForShift(pool, Number(actualUserId));
    
    // NEW: Use the database function to check if we should reset activity
    const shouldReset = await shouldResetActivity(pool, Number(actualUserId));
    
    // Check if we already have a row for this effective date
    const existingResult = await pool.query(
      `SELECT * FROM activity_data 
       WHERE user_id = $1 AND today_date = $2`, 
      [actualUserId, effectiveDateStr]
    );
    
    if (existingResult.rows.length > 0 && !shouldReset) {
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
        
        // Update existing record with time tracking for current shift-anchored day
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET is_currently_active = $1, 
               today_active_seconds = $2, 
               today_inactive_seconds = $3, 
               last_session_start = $4, 
               updated_at = NOW() 
           WHERE user_id = $5 AND today_date = $6
           RETURNING *`,
          [isCurrentlyActive, newActiveSeconds, newInactiveSeconds, sessionStart, actualUserId, effectiveDateStr]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      } else {
        // State hasn't changed, just update the timestamp
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET updated_at = NOW() 
           WHERE user_id = $1 AND today_date = $2
           RETURNING *`,
          [actualUserId, effectiveDateStr]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      }
    } else if (existingResult.rows.length > 0 && shouldReset) {
      // We have an existing row but this is a new shift period
      // Create a new row with 0 values for the new shift
      const now = new Date();
      const sessionStart = isCurrentlyActive ? now : null;
      
      const insertResult = await pool.query(
        `INSERT INTO activity_data 
         (user_id, is_currently_active, last_session_start, today_date, 
          today_active_seconds, today_inactive_seconds) 
         VALUES ($1, $2, $3, $4, 0, 0) 
         RETURNING *`,
        [actualUserId, isCurrentlyActive, sessionStart, effectiveDateStr]
      );
      
      return NextResponse.json(insertResult.rows[0], { status: 201 });
    } else {
      // Create new record for current shift-anchored day (Philippines timezone)
      const now = new Date();
      const sessionStart = isCurrentlyActive ? now : null;
      
      const insertResult = await pool.query(
        `INSERT INTO activity_data 
         (user_id, is_currently_active, last_session_start, today_date, 
          today_active_seconds, today_inactive_seconds) 
         VALUES ($1, $2, $3, $4, 0, 0) 
         RETURNING *`,
        [actualUserId, isCurrentlyActive, sessionStart, effectiveDateStr]
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
    
    // NEW: Use the database function to get the correct activity date
    const effectiveDateStr = await getActivityDateForShift(pool, Number(actualUserId));
    
    // NEW: Use the database function to check if we should reset activity
    const shouldReset = await shouldResetActivity(pool, Number(actualUserId));
    
    const existingResult = await pool.query(
      `SELECT * FROM activity_data WHERE user_id = $1 AND today_date = $2`, 
      [actualUserId, effectiveDateStr]
    );
    
    if (existingResult.rows.length > 0 && !shouldReset) {
      const existing = existingResult.rows[0];
      
      // If frontend values are provided, use them directly
      if (frontendActiveSeconds !== undefined || frontendInactiveSeconds !== undefined) {
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET today_active_seconds = $1, 
               today_inactive_seconds = $2, 
               updated_at = NOW() 
           WHERE user_id = $3 AND today_date = $4
           RETURNING *`,
          [frontendActiveSeconds || 0, frontendInactiveSeconds || 0, actualUserId, effectiveDateStr]
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
        
                // Update the record with accumulated time for current day
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET today_active_seconds = $1, 
               today_inactive_seconds = $2, 
               updated_at = NOW() 
           WHERE user_id = $3 AND today_date = $4
           RETURNING *`,
          [newActiveSeconds, newInactiveSeconds, actualUserId, effectiveDateStr]
        );
        
        return NextResponse.json(updateResult.rows[0]);
      } else {
        // No time to add, just update timestamp
        const updateResult = await pool.query(
          `UPDATE activity_data 
           SET updated_at = NOW() 
           WHERE user_id = $1 AND today_date = $2
           RETURNING *`,
          [actualUserId, effectiveDateStr]
        );
        return NextResponse.json(updateResult.rows[0]);
      }
    } else if (existingResult.rows.length > 0 && shouldReset) {
      // We have an existing row but this is a new shift period
      // Create a new row with 0 values for the new shift
      const insertResult = await pool.query(
        `INSERT INTO activity_data 
         (user_id, is_currently_active, last_session_start, today_date, 
          today_active_seconds, today_inactive_seconds) 
         VALUES ($1, $2, $3, $4, 0, 0) 
         RETURNING *`,
        [actualUserId, false, null, effectiveDateStr]
      );
      
      return NextResponse.json(insertResult.rows[0], { status: 201 });
    } else {
      return NextResponse.json({ error: 'Activity data not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Error updating activity time:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 