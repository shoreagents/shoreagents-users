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
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    try {
      // Get total count
      const countResult = await executeQuery(
        'SELECT COUNT(*) as total FROM health_check_records WHERE user_id = $1',
        [user.id]
      )
      
      const total = parseInt(countResult[0].total)

      // Get health check records
      const result = await executeQuery(
        `SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email,
               upi.first_name as user_first_name,
               upi.middle_name as user_middle_name,
               upi.last_name as user_last_name,
               npi.first_name as nurse_first_name,
               npi.middle_name as nurse_middle_name,
               npi.last_name as nurse_last_name
        FROM health_check_records hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        LEFT JOIN personal_info upi ON hcr.user_id = upi.user_id
        LEFT JOIN personal_info npi ON hcr.nurse_id = npi.user_id
        WHERE hcr.user_id = $1
        ORDER BY hcr.visit_date DESC, hcr.visit_time DESC
        LIMIT $2 OFFSET $3`,
        [user.id, limit, offset]
      )
      
      return NextResponse.json({ 
        success: true, 
        records: result,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      })
      
    } catch (e) {
      console.error('Error fetching health check records:', e)
      return NextResponse.json({ 
        error: 'Internal server error',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (e) {
    console.error('Error in records request:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
