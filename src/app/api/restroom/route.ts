import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, initializeDatabase } from '@/lib/database-server';

// Helper function to get user from request (matches pattern from other APIs)
function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    return authData.user
  } catch {
    return null
  }
}

// GET - Get restroom status for a user
export async function GET(request: NextRequest) {
  try {
    await initializeDatabase()
    
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user ID from database using email
    const userResult = await executeQuery<any>(
      `SELECT id FROM users WHERE email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id

    // Get current date in Philippines timezone
    const now = new Date()
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}))
    const today = philippinesTime.toISOString().split('T')[0] // YYYY-MM-DD format

    // Get restroom status
    const restroomResult = await executeQuery<any>(
      `SELECT * FROM agent_restroom_status WHERE agent_user_id = $1`,
      [userId]
    )

    // If no record exists, return default status
    if (restroomResult.length === 0) {
      return NextResponse.json({
        id: null,
        agent_user_id: userId,
        is_in_restroom: false,
        restroom_count: 0,
        daily_restroom_count: 0,
        last_daily_reset: today,
        created_at: null,
        updated_at: null
      })
    }

    const restroomStatus = restroomResult[0]
    
    // Check if we need to reset the daily count for a new day
    // Use database-level date comparison to avoid timezone issues
    const resetCheckResult = await executeQuery<any>(
      `SELECT 
         CASE WHEN last_daily_reset < CURRENT_DATE THEN true ELSE false END as should_reset,
         last_daily_reset
       FROM agent_restroom_status 
       WHERE agent_user_id = $1`,
      [userId]
    )
    
    const shouldReset = resetCheckResult[0]?.should_reset || false
    
    // If the last reset was not today, reset the daily count but preserve total count
    if (shouldReset) {
      const resetResult = await executeQuery<any>(
        `UPDATE agent_restroom_status 
         SET daily_restroom_count = 0, 
             last_daily_reset = CURRENT_DATE, 
             updated_at = NOW()
         WHERE agent_user_id = $1
         RETURNING *`,
        [userId]
      )
      
      return NextResponse.json(resetResult[0])
    }
    

    return NextResponse.json(restroomStatus)
  } catch (error) {
    console.error('Error in GET /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update restroom status
export async function POST(request: NextRequest) {
  try {
    await initializeDatabase()
    
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { is_in_restroom } = body

    if (typeof is_in_restroom !== 'boolean') {
      return NextResponse.json({ 
        error: 'is_in_restroom (boolean) is required' 
      }, { status: 400 })
    }

    // Get user ID from database using email
    const userResult = await executeQuery<any>(
      `SELECT id FROM users WHERE email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id
    
    const existingResult = await executeQuery<any>(
      `SELECT 
         *,
         CASE WHEN last_daily_reset < CURRENT_DATE THEN true ELSE false END as should_reset
       FROM agent_restroom_status 
       WHERE agent_user_id = $1`,
      [userId]
    )

    // Get current status before update for debugging
    const currentStatus = existingResult.length > 0 ? existingResult[0] : null

    let shouldResetDailyCount = false
    if (existingResult.length > 0) {
      shouldResetDailyCount = currentStatus.should_reset || false
    } else {
      // If no existing record, it's a new day
      shouldResetDailyCount = true
    }
    
    // Use upsert to create or update the record
    const upsertResult = await executeQuery<any>(
      `INSERT INTO agent_restroom_status (agent_user_id, is_in_restroom, restroom_count, daily_restroom_count, last_daily_reset, created_at, updated_at)
       VALUES ($1, $2, CASE WHEN $2 = true THEN 1 ELSE 0 END, CASE WHEN $2 = true THEN 1 ELSE 0 END, CURRENT_DATE, NOW(), NOW())
       ON CONFLICT (agent_user_id) 
       DO UPDATE SET 
         is_in_restroom = EXCLUDED.is_in_restroom,
         restroom_count = CASE 
           WHEN EXCLUDED.is_in_restroom = true AND agent_restroom_status.is_in_restroom = false 
           THEN agent_restroom_status.restroom_count + 1
           ELSE agent_restroom_status.restroom_count
         END,
         daily_restroom_count = CASE 
           WHEN $3 = true THEN 1  -- Reset and increment if new day and going to restroom
           WHEN EXCLUDED.is_in_restroom = true AND agent_restroom_status.is_in_restroom = false 
           THEN agent_restroom_status.daily_restroom_count + 1  -- Increment when going to restroom
           ELSE agent_restroom_status.daily_restroom_count  -- Keep current count for all other cases (including leaving restroom)
         END,
         last_daily_reset = CASE 
           WHEN $3 = true THEN CURRENT_DATE  -- Update reset date if it's a new day
           ELSE agent_restroom_status.last_daily_reset
         END,
         updated_at = NOW()
       RETURNING *`,
      [userId, is_in_restroom, shouldResetDailyCount]
    )
    

    return NextResponse.json(upsertResult[0])
  } catch (error) {
    console.error('Error in POST /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update restroom status
export async function PUT(request: NextRequest) {
  try {
    await initializeDatabase()
    
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { is_in_restroom } = body

    if (typeof is_in_restroom !== 'boolean') {
      return NextResponse.json({ 
        error: 'is_in_restroom (boolean) is required' 
      }, { status: 400 })
    }

    // Get user ID from database using email
    const userResult = await executeQuery<any>(
      `SELECT id FROM users WHERE email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id

    const updateResult = await executeQuery<any>(
      `UPDATE agent_restroom_status 
       SET is_in_restroom = $1, updated_at = NOW()
       WHERE agent_user_id = $2
       RETURNING *`,
      [is_in_restroom, userId]
    )

    if (updateResult.length === 0) {
      return NextResponse.json({ error: 'Restroom status not found' }, { status: 404 })
    }

    return NextResponse.json(updateResult[0])
  } catch (error) {
    console.error('Error in PUT /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove restroom status record
export async function DELETE(request: NextRequest) {
  try {
    await initializeDatabase()
    
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user ID from database using email
    const userResult = await executeQuery<any>(
      `SELECT id FROM users WHERE email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id

    await executeQuery<any>(
      `DELETE FROM agent_restroom_status WHERE agent_user_id = $1`,
      [userId]
    )

    return NextResponse.json({ message: 'Restroom status deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
