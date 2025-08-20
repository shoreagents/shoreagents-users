import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, complaint, symptoms, priority = 'normal' } = body

    if (!user_id || !complaint) {
      return NextResponse.json({ 
        error: 'user_id and complaint are required' 
      }, { status: 400 })
    }

    const pool = getPool()
    
    try {
      // Create health check request
      const result = await pool.query(
        `INSERT INTO health_check_requests (user_id, complaint, symptoms, priority, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [user_id, complaint, symptoms, priority]
      )

      const newRequest = result.rows[0]
      
      // Notify through pg_notify for real-time updates
      await pool.query(
        `SELECT pg_notify('health_check_events', $1)`,
        [JSON.stringify({
          event: 'request_created',
          request_id: newRequest.id,
          user_id: newRequest.user_id,
          status: newRequest.status,
          priority: newRequest.priority,
          complaint: newRequest.complaint,
          request_time: newRequest.request_time
        })]
      )

      return NextResponse.json({ 
        success: true, 
        request: newRequest 
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('Error creating health check request:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get('user_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    if (!user_id) {
      return NextResponse.json({ 
        error: 'user_id is required' 
      }, { status: 400 })
    }

    const pool = getPool()
    
    try {
      let query = `
        SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email
        FROM health_check_requests hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        WHERE hcr.user_id = $1
      `
      const params: (string | number)[] = [user_id]
      let paramCount = 1

      if (status) {
        paramCount++
        query += ` AND hcr.status = $${paramCount}`
        params.push(status)
      }

      query += ` ORDER BY hcr.request_time DESC LIMIT $${paramCount + 1}`
      params.push(limit)

      const result = await pool.query(query, params)
      
      return NextResponse.json({ 
        success: true, 
        requests: result.rows 
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('Error fetching health check requests:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
