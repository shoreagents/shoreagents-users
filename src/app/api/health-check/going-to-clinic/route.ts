import { NextRequest, NextResponse } from 'next/server'
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

    const { request_id, going_to_clinic } = await request.json()

    if (!request_id || typeof going_to_clinic !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    try {
      // First verify the request belongs to the user
      const verifyResult = await executeQuery(
        `SELECT id, user_id FROM health_check_requests WHERE id = $1`,
        [request_id]
      )

      if (verifyResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Health check request not found' },
          { status: 404 }
        )
      }

      if (verifyResult[0].user_id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized to update this request' },
          { status: 403 }
        )
      }

      // Update the health check request and trigger notification in one query
      // The trigger will automatically set going_to_clinic_at timestamp when going_to_clinic becomes true
      const result = await executeQuery(
        `UPDATE health_check_requests 
         SET going_to_clinic = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [going_to_clinic, request_id]
      )

      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Health check request not found' },
          { status: 404 }
        )
      }

      const updatedRequest = result[0]

      // Trigger database function that handles both update and notification
      await executeQuery(
        `SELECT notify_health_check_field_update($1, $2, $3)`,
        [updatedRequest.id, 'going_to_clinic', going_to_clinic]
      )

      return NextResponse.json({
        success: true,
        request: updatedRequest,
        updated_at: updatedRequest.updated_at
      })

    } catch (error) {
      console.error('Error in going-to-clinic API:', error)
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in going-to-clinic request:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
