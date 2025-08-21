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
    const nurse_id = searchParams.get('nurse_id')
    const day_of_week = searchParams.get('day_of_week')

    const pool = getPool()
    
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

      const result = await pool.query(query, params)
      
      return NextResponse.json({ 
        success: true, 
        availability: result.rows
      })
      
    } finally {
      await pool.end()
    }
    
  } catch (e) {
    console.error('Error fetching nurse availability:', e)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: e instanceof Error ? e.message : 'Unknown error'
    }, { status: 500 })
  }
}
