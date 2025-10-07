import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!user_id) {
      return NextResponse.json({ 
        success: false,
        error: 'User ID is required' 
      }, { status: 400 })
    }

    try {
      const query = `
        SELECT hcr.*, 
               u.email as user_email,
               pi.first_name as user_first_name,
               pi.last_name as user_last_name,
               nurse.email as nurse_email,
               nurse_pi.first_name as nurse_first_name,
               nurse_pi.last_name as nurse_last_name
        FROM health_check_requests hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN personal_info pi ON hcr.user_id = pi.user_id
        LEFT JOIN users nurse ON hcr.nurse_id = nurse.id
        LEFT JOIN personal_info nurse_pi ON hcr.nurse_id = nurse_pi.user_id
        WHERE hcr.user_id = $1
        ORDER BY hcr.request_time DESC
        LIMIT $2 OFFSET $3
      `
      
      const result = await executeQuery(query, [user_id, limit, offset])
      
      return NextResponse.json({ 
        success: true, 
        requests: result
      })
      
    } catch (e) {
      console.error('Error in database query:', e)
      return NextResponse.json({ 
        error: 'Database error',
        details: e instanceof Error ? e.message : 'Unknown error'
      }, { status: 500 })
    }
    
  } catch (e) {
    console.error('Error fetching health check requests:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
