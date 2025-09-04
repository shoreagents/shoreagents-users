import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email parameter is required' 
      }, { status: 400 })
    }

    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email])
    if (userResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const userId = userResult.rows[0].id

    // Get current date for activity data lookup
    const currentTime = new Date()
    const currentDate = currentTime.toISOString().split('T')[0]

    // Get today's activity data
    const activityResult = await pool.query(
      `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
       FROM activity_data 
       WHERE user_id = $1 AND today_date = $2::date
       ORDER BY today_date DESC 
       LIMIT 1`,
      [userId, currentDate]
    )

    let timerData = {
      isActive: false,
      activeSeconds: 0,
      inactiveSeconds: 0,
      sessionStart: new Date().toISOString(),
      email: email,
      userId: userId
    }

    if (activityResult.rows.length > 0) {
      const dbData = activityResult.rows[0]
      timerData = {
        isActive: dbData.is_currently_active || false,
        activeSeconds: dbData.today_active_seconds || 0,
        inactiveSeconds: dbData.today_inactive_seconds || 0,
        sessionStart: dbData.last_session_start || new Date().toISOString(),
        email: email,
        userId: userId
      }
    }

    // Get shift information using the get_agent_shift_info function
    const shiftResult = await pool.query(
      `SELECT * FROM get_agent_shift_info($1)`,
      [userId]
    )

    let shiftInfo = null
    if (shiftResult.rows.length > 0) {
      const profile = shiftResult.rows[0]
      shiftInfo = {
        period: profile.shift_period || '',
        schedule: profile.shift_schedule || '',
        time: profile.shift_time || ''
      }
    }

    return NextResponse.json({
      success: true,
      timerData: {
        ...timerData,
        shiftInfo: shiftInfo
      }
    })

  } catch (error) {
    console.error('Error fetching timer status:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch timer status' 
    }, { status: 500 })
  }
}
