import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    
    // Handle both hybrid and regular auth structures
    let userId = authData.user.id
    
    // If it's a hybrid auth system, use railway_id if available
    if (authData.hybrid && authData.user.railway_id) {
      userId = authData.user.railway_id
    }
    
    // Ensure we have a valid numeric ID
    if (!userId || isNaN(Number(userId))) {
      console.error('Invalid user ID:', userId)
      return null
    }
    
    return {
      ...authData.user,
      id: Number(userId)
    }
  } catch (error) {
    console.error('Error parsing auth cookie:', error)
    return null
  }
}

// GET /api/events/check-status - Check if user is currently in an event
export async function GET(request: NextRequest) {
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser?.email) {
      return NextResponse.json({ success: false, message: 'User not authenticated' }, { status: 401 })
    }

    // Check if user is currently in an event
    const eventCheckQuery = `
      SELECT ea.is_going, e.title as event_title, e.id as event_id
      FROM event_attendance ea
      JOIN events e ON ea.event_id = e.id
      WHERE ea.user_id = $1 AND ea.is_going = true AND ea.is_back = false
      AND e.status NOT IN ('cancelled', 'ended')
    `
    
    const eventResult = await executeQuery(eventCheckQuery, [currentUser.id])
    
    if (eventResult.length > 0) {
      const event = eventResult[0]
      return NextResponse.json({
        success: true,
        isInEvent: true,
        currentEvent: {
          id: event.event_id,
          title: event.event_title
        }
      })
    }

    return NextResponse.json({
      success: true,
      isInEvent: false,
      currentEvent: null
    })

  } catch (error) {
    console.error('Error checking event status:', error)
    return NextResponse.json({ 
      success: false,
      message: 'Failed to check event status' 
    }, { status: 500 })
  }
}
