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
    const nurse_id = searchParams.get('nurse_id')
    const day_of_week = searchParams.get('day_of_week')

    try {
      let query = `
        SELECT hca.*, 
               u.email as nurse_email,
               u.user_type as nurse_role,
               pi.first_name as nurse_first_name,
               pi.middle_name as nurse_middle_name,
               pi.last_name as nurse_last_name
        FROM health_check_availability hca
        LEFT JOIN users u ON hca.nurse_id = u.id
        LEFT JOIN personal_info pi ON hca.nurse_id = pi.user_id
        WHERE 1=1
      `
      const params: (string | number)[] = []
      let paramCount = 0

      if (nurse_id) {
        paramCount++
        query += ` AND hca.nurse_id = $${paramCount}`
        params.push(nurse_id)
      }

      if (day_of_week !== undefined && day_of_week !== null) {
        paramCount++
        query += ` AND hca.day_of_week = $${paramCount}`
        params.push(day_of_week)
      }

      query += ` ORDER BY hca.day_of_week ASC, hca.shift_start ASC`

      const result = await executeQuery(query, params)
      
      return NextResponse.json({ 
        success: true, 
        availability: result
      })
      
    } catch (e) {
      console.error('Error fetching nurse availability:', e)
      return NextResponse.json({ 
        error: 'Internal server error',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 })
    }
  } catch (e) {
    console.error('Error in availability request:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
