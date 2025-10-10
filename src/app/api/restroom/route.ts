import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user with agent and job info using Prisma
    const user = await prisma.user.findUnique({
      where: { email: currentUser.email },
      include: {
        agent: {
          include: {
            jobInfo: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id
    const shiftTime = user.agent?.jobInfo?.[0]?.shiftTime

    // Get current time in Philippines timezone
    const now = new Date()

    // Get restroom status using Prisma
    let restroomStatus = await prisma.agentRestroomStatus.findUnique({
      where: { agentUserId: userId }
    })

    // If no record exists, return default status
    if (!restroomStatus) {
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
    
    // Check if we need to reset based on shift schedule using updated_at field
    // This automatically resets the count when user loads the page if it's a new shift period
    const shouldReset = shouldResetBasedOnUpdatedAt(restroomStatus.updatedAt.toISOString(), now, shiftTime || '')
    
    // If it's a new shift period, automatically reset the daily count but preserve total count
    if (shouldReset) {
      restroomStatus = await prisma.agentRestroomStatus.update({
        where: { agentUserId: userId },
        data: {
          dailyRestroomCount: 0,
          updatedAt: new Date()
        }
      })
    }

    // Convert Prisma result to match expected API format
    return NextResponse.json({
      id: restroomStatus.id,
      agent_user_id: restroomStatus.agentUserId,
      is_in_restroom: restroomStatus.isInRestroom,
      restroom_count: restroomStatus.restroomCount,
      daily_restroom_count: restroomStatus.dailyRestroomCount,
      created_at: restroomStatus.createdAt,
      updated_at: restroomStatus.updatedAt
    })
  } catch (error) {
    console.error('Error in GET /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create or update restroom status (optimized)
export async function POST(request: NextRequest) {
  try {
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

    // Get user with agent and job info using Prisma
    const user = await prisma.user.findUnique({
      where: { email: currentUser.email },
      include: {
        agent: {
          include: {
            jobInfo: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id
    const shiftTime = user.agent?.jobInfo?.[0]?.shiftTime

    // Get existing restroom status using Prisma
    const existing = await prisma.agentRestroomStatus.findUnique({
      where: { agentUserId: userId }
    })

    let result

    if (!existing) {
      // Create new record using Prisma
      result = await prisma.agentRestroomStatus.create({
        data: {
          agentUserId: userId,
          isInRestroom: is_in_restroom,
          restroomCount: 0,
          dailyRestroomCount: 0
        }
      })
    } else {
      // Update existing record
      // Check if we need to reset based on shift schedule using updated_at field
      const shouldReset = shouldResetBasedOnUpdatedAt(existing.updatedAt.toISOString(), now, shiftTime || '')
      
      // Only increment counts when transitioning from false to true (entering restroom)
      const shouldIncrement = is_in_restroom && !existing.isInRestroom
      
      const newRestroomCount = shouldIncrement ? existing.restroomCount + 1 : existing.restroomCount
      
      let newDailyCount
      if (shouldReset) {
        // If we need to reset, start fresh
        newDailyCount = shouldIncrement ? 1 : 0
      } else {
        // If no reset needed, increment if entering restroom
        newDailyCount = shouldIncrement ? existing.dailyRestroomCount + 1 : existing.dailyRestroomCount
      }
      
      result = await prisma.agentRestroomStatus.update({
        where: { agentUserId: userId },
        data: {
          isInRestroom: is_in_restroom,
          restroomCount: newRestroomCount,
          dailyRestroomCount: newDailyCount,
          updatedAt: new Date()
        }
      })
    }

    // Convert Prisma result to match expected API format
    return NextResponse.json({
      id: result.id,
      agent_user_id: result.agentUserId,
      is_in_restroom: result.isInRestroom,
      restroom_count: result.restroomCount,
      daily_restroom_count: result.dailyRestroomCount,
      created_at: result.createdAt,
      updated_at: result.updatedAt
    })
  } catch (error) {
    console.error('Error in POST /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update restroom status
export async function PUT(request: NextRequest) {
  try {
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

    // Get user ID using Prisma
    const user = await prisma.user.findUnique({
      where: { email: currentUser.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id

    const updateResult = await prisma.agentRestroomStatus.update({
      where: { agentUserId: userId },
      data: {
        isInRestroom: is_in_restroom,
        updatedAt: new Date()
      }
    })

    // Convert Prisma result to match expected API format
    return NextResponse.json({
      id: updateResult.id,
      agent_user_id: updateResult.agentUserId,
      is_in_restroom: updateResult.isInRestroom,
      restroom_count: updateResult.restroomCount,
      daily_restroom_count: updateResult.dailyRestroomCount,
      created_at: updateResult.createdAt,
      updated_at: updateResult.updatedAt
    })
  } catch (error) {
    console.error('Error in PUT /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove restroom status record
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get user ID using Prisma
    const user = await prisma.user.findUnique({
      where: { email: currentUser.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = user.id

    await prisma.agentRestroomStatus.delete({
      where: { agentUserId: userId }
    })

    return NextResponse.json({ message: 'Restroom status deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/restroom:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

