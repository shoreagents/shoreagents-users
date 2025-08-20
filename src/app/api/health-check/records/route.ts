import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!user_id) {
      return NextResponse.json({ 
        error: 'user_id is required' 
      }, { status: 400 })
    }

    const pool = getPool()
    
    try {
      // Get total count
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM health_check_records WHERE user_id = $1',
        [user_id]
      )
      
      const total = parseInt(countResult.rows[0].total)

      // Get health check records
      const result = await pool.query(
        `SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email
        FROM health_check_records hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        WHERE hcr.user_id = $1
        ORDER BY hcr.visit_date DESC, hcr.visit_time DESC
        LIMIT $2 OFFSET $3`,
        [user_id, limit, offset]
      )
      
      return NextResponse.json({ 
        success: true, 
        records: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('Error fetching health check records:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
