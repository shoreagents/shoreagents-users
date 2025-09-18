import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

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
    const { request_id } = body

    if (!request_id) {
      return NextResponse.json({ 
        success: false,
        error: 'request_id is required' 
      }, { status: 400 })
    }

    const pool = getPool()
    
    try {
      // First, check if the request exists and belongs to the user
      const checkResult = await pool.query(
        `SELECT id, status, user_id FROM health_check_requests 
         WHERE id = $1 AND user_id = $2`,
        [request_id, user.id]
      )

      if (checkResult.rows.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Health check request not found or not authorized' 
        }, { status: 404 })
      }

      const request = checkResult.rows[0]

      // Only allow canceling if status is 'pending' or 'approved'
      if (!['pending', 'approved'].includes(request.status)) {
        return NextResponse.json({ 
          success: false,
          error: 'Only pending or approved requests can be canceled' 
        }, { status: 400 })
      }

      // Update the request status to 'cancelled'
      const updateResult = await pool.query(
        `UPDATE health_check_requests 
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [request_id, user.id]
      )

      if (updateResult.rows.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Failed to cancel request' 
        }, { status: 500 })
      }

      const cancelledRequest = updateResult.rows[0]
      
      // Notify through pg_notify for real-time updates
      await pool.query(
        `SELECT pg_notify('health_check_events', $1)`,
        [JSON.stringify({
          event: 'request_status_changed',
          request_id: cancelledRequest.id,
          user_id: cancelledRequest.user_id,
          nurse_id: cancelledRequest.nurse_id,
          old_status: request.status,
          new_status: 'cancelled',
          updated_at: cancelledRequest.updated_at
        })]
      )

      return NextResponse.json({ 
        success: true, 
        request: cancelledRequest 
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('Error canceling health check request:', e)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
