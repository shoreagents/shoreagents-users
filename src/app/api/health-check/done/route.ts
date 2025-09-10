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

    const { request_id, done } = await request.json()

    if (!request_id || typeof done !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const pool = getPool()
    
    try {
      // First verify the request belongs to the user
      const verifyResult = await pool.query(
        `SELECT id, user_id FROM health_check_requests WHERE id = $1`,
        [request_id]
      )

      if (verifyResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Health check request not found' },
          { status: 404 }
        )
      }

      if (verifyResult.rows[0].user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized to update this request' },
          { status: 403 }
        )
      }

      // Update the health check request with automatic state transitions
      // The trigger will automatically set in_clinic to false when done is set to true
      const result = await pool.query(
        `UPDATE health_check_requests 
         SET done = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [done, request_id]
      )

      if (result.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Health check request not found' },
          { status: 404 }
        )
      }

      const updatedRequest = result.rows[0]

      // Trigger database function that handles both update and notification
      await pool.query(
        `SELECT notify_health_check_field_update($1, $2, $3)`,
        [updatedRequest.id, 'done', done]
      )

      return NextResponse.json({
        success: true,
        request: updatedRequest,
        updated_at: updatedRequest.updated_at
      })

    } finally {
      await pool.end()
    }

  } catch (error) {
    console.error('Error in done API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
