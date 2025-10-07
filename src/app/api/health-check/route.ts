import { NextRequest, NextResponse } from 'next/server'
import { parseShiftTime } from '@/lib/shift-utils'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

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

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { complaint, symptoms, priority = 'normal' } = body

    if (!complaint) {
      return NextResponse.json({ 
        error: 'complaint is required' 
      }, { status: 400 })
    }

    // Check if shift has ended
    try {
      // Get user's shift time from profile
      const profileResult = await executeQuery(
        `SELECT shift_time FROM personal_info WHERE user_id = $1`,
        [user.id]
      )
      
      const shiftTime = profileResult[0]?.shift_time
      if (shiftTime) {
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }))
        const shiftParsed = parseShiftTime(shiftTime, nowPH)
        
        if (shiftParsed?.endTime && nowPH > shiftParsed.endTime) {
          return NextResponse.json({
            success: false,
            error: 'Cannot create health check request - shift has ended'
          }, { status: 400 })
        }
      }
    } catch (shiftError) {
      console.error('Error checking shift end status:', shiftError)
      // Continue with request creation if shift check fails
    }
    
    try {
      // Find an available nurse (user_id 1 is the nurse)
      let nurse_id = null
      try {
        const nurseResult = await executeQuery(
          `SELECT id FROM users WHERE id = 1 AND role = 'Internal' LIMIT 1`
        )
        nurse_id = nurseResult.length > 0 ? nurseResult[0].id : 1 // Default to 1 if not found
      } catch (nurseError) {
        console.error('Error finding nurse:', nurseError)
        nurse_id = 1 // Default to user_id 1 as nurse
      }
      
      // Create health check request with nurse assignment
      const result = await executeQuery(
        `INSERT INTO health_check_requests (user_id, nurse_id, complaint, symptoms, priority, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [user.id, nurse_id, complaint, symptoms, priority]
      )

      const newRequest = result[0]
      
      // Get user email for socket notification
      const userEmailResult = await executeQuery(
        `SELECT email FROM users WHERE id = $1`,
        [user.id]
      )
      const userEmail = userEmailResult[0]?.email

      // Notify through pg_notify for real-time updates
      await executeQuery(
        `SELECT pg_notify('health_check_events', $1)`,
        [JSON.stringify({
          event: 'request_created',
          request_id: newRequest.id,
          user_id: newRequest.user_id,
          user_email: userEmail,
          nurse_id: newRequest.nurse_id,
          status: newRequest.status,
          priority: newRequest.priority,
          complaint: newRequest.complaint,
          symptoms: newRequest.symptoms,
          request_time: newRequest.request_time
        })]
      )

      return NextResponse.json({ 
        success: true, 
        request: newRequest 
      })
      
    } catch (e) {
      console.error('Error creating health check request:', e)
      return NextResponse.json({ 
        error: 'Internal server error',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (e) {
    console.error('Error in health check request:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    try {
      let query = `
        SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email,
               upi.first_name as user_first_name,
               upi.middle_name as user_middle_name,
               upi.last_name as user_last_name,
               npi.first_name as nurse_first_name,
               npi.middle_name as nurse_middle_name,
               npi.last_name as nurse_last_name
        FROM health_check_requests hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        LEFT JOIN personal_info upi ON hcr.user_id = upi.user_id
        LEFT JOIN personal_info npi ON hcr.nurse_id = npi.user_id
        WHERE hcr.user_id = $1
      `
      const params: (string | number)[] = [user.id]
      let paramCount = 1

      if (status) {
        paramCount++
        query += ` AND hcr.status = $${paramCount}`
        params.push(status)
      }

      query += ` ORDER BY hcr.request_time DESC LIMIT $${paramCount + 1}`
      params.push(limit)

      const result = await executeQuery(query, params)
      
      return NextResponse.json({ 
        success: true, 
        requests: result 
      })
      
    } catch (e) {
      console.error('Error fetching health check requests:', e)
      return NextResponse.json({ 
        error: 'Internal server error',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (e) {
    console.error('Error in health check GET request:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
