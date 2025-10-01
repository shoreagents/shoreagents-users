import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, initializeDatabase } from '@/lib/database-server';
import { parseShiftTime } from '@/lib/shift-utils';

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


// Helper function to get the shift start time for a given date
function getShiftStartForDate(date: Date, shiftInfo: any): Date {
  const shiftStart = new Date(date)
  const [startHour, startMinute] = shiftInfo.startTime.toTimeString().split(':').slice(0, 2).map(Number)
  
  shiftStart.setHours(startHour, startMinute, 0, 0)
  
  if (shiftInfo.isNightShift) {
    // For night shifts, if current time is before the start time today,
    // the shift actually started yesterday
    const currentTime = date.getHours() * 60 + date.getMinutes()
    const shiftStartTime = startHour * 60 + startMinute
    
    if (currentTime < shiftStartTime) {
      shiftStart.setDate(shiftStart.getDate() - 1)
    }
  }
  
  return shiftStart
}

// Check if restroom count should reset based on shift schedule using updated_at field
// This handles both automatic reset (when user loads page) and manual reset (when user clicks button)
function shouldResetBasedOnUpdatedAt(updatedAt: string | null, currentTime: Date, shiftTime: string): boolean {
  if (!updatedAt || !shiftTime) {
    return true
  }

  try {
    const lastUpdate = new Date(updatedAt)
    const shiftInfo = parseShiftTime(shiftTime, currentTime)
    
    if (!shiftInfo) {
      return true
    }

    if (shiftInfo.isNightShift) {
      // For night shifts, check if we're in a different shift period
      const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo)
      const lastShiftStart = getShiftStartForDate(lastUpdate, shiftInfo)
      return currentShiftStart.getTime() !== lastShiftStart.getTime()
    } else {
      // For day shifts, check if it's a different calendar day
      const lastUpdateDate = lastUpdate.toISOString().split('T')[0]
      const currentDate = currentTime.toISOString().split('T')[0]
      return lastUpdateDate !== currentDate
    }
  } catch (error) {
    console.error('Error in shouldResetBasedOnUpdatedAt:', error)
    return true
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

    // Get user ID and shift information from database using email
    const userResult = await executeQuery<any>(
      `SELECT u.id, ji.shift_time 
       FROM users u
       LEFT JOIN job_info ji ON u.id = ji.agent_user_id
       WHERE u.email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id
    const shiftTime = userResult[0].shift_time

    // Get current time in Philippines timezone
    const now = new Date()

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
        created_at: null,
        updated_at: null
      })
    }

    const restroomStatus = restroomResult[0]
    
    // Check if we need to reset based on shift schedule using updated_at field
    // This automatically resets the count when user loads the page if it's a new shift period
    const shouldReset = shouldResetBasedOnUpdatedAt(restroomStatus.updated_at, now, shiftTime)
    
    // If it's a new shift period, automatically reset the daily count but preserve total count
    if (shouldReset) {
      const resetResult = await executeQuery<any>(
        `UPDATE agent_restroom_status 
         SET daily_restroom_count = 0, 
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

// POST - Create or update restroom status (optimized)
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

    // Get current date in Philippines timezone using Intl.DateTimeFormat
    const now = new Date()

    // Get user ID and shift information from database
    const userResult = await executeQuery<any>(
      `SELECT u.id, ji.shift_time 
       FROM users u
       LEFT JOIN job_info ji ON u.id = ji.agent_user_id
       WHERE u.email = $1`,
      [currentUser.email]
    )

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = userResult[0].id
    const shiftTime = userResult[0].shift_time

    // Get existing restroom status
    const existingResult = await executeQuery<any>(
      `SELECT * FROM agent_restroom_status WHERE agent_user_id = $1`,
      [userId]
    )

    let result

    if (existingResult.length === 0) {
      // Create new record
      result = await executeQuery<any>(
        `INSERT INTO agent_restroom_status (agent_user_id, is_in_restroom, restroom_count, daily_restroom_count, created_at, updated_at)
         VALUES ($1, $2, 0, 0, NOW(), NOW())
         RETURNING *`,
        [userId, is_in_restroom]
      )
    } else {
      // Update existing record
      const existing = existingResult[0]
      
      // Check if we need to reset based on shift schedule using updated_at field
      const shouldReset = shouldResetBasedOnUpdatedAt(existing.updated_at, now, shiftTime)
      
      // Only increment counts when transitioning from false to true (entering restroom)
      const shouldIncrement = is_in_restroom && !existing.is_in_restroom
      
      const newRestroomCount = shouldIncrement ? existing.restroom_count + 1 : existing.restroom_count
      
      let newDailyCount
      if (shouldReset) {
        // If we need to reset, start fresh
        newDailyCount = shouldIncrement ? 1 : 0
      } else {
        // If no reset needed, increment if entering restroom
        newDailyCount = shouldIncrement ? existing.daily_restroom_count + 1 : existing.daily_restroom_count
      }
      
      result = await executeQuery<any>(
        `UPDATE agent_restroom_status 
         SET is_in_restroom = $2,
             restroom_count = $3,
             daily_restroom_count = $4,
             updated_at = NOW()
         WHERE agent_user_id = $1
         RETURNING *`,
        [userId, is_in_restroom, newRestroomCount, newDailyCount]
      )
    }

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }


    return NextResponse.json(result[0])
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

