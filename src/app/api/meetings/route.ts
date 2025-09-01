import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

// GET /api/meetings - Get user's meetings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agent_user_id = searchParams.get('agent_user_id')
    const days = parseInt(searchParams.get('days') || '7')

    if (!agent_user_id) {
      return NextResponse.json({ error: 'agent_user_id is required' }, { status: 400 })
    }

    const query = `SELECT * FROM get_user_meetings($1, $2)`
    const result = await executeQuery(query, [agent_user_id, days])

    return NextResponse.json({
      success: true,
      meetings: result
    })
  } catch (error) {
    console.error('Error fetching meetings:', error)
    return NextResponse.json({ error: 'Failed to fetch meetings' }, { status: 500 })
  }
}

// POST /api/meetings - Create a new meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_user_id, title, description, duration, type } = body

    // Validate required fields
    if (!agent_user_id || !title || !duration || !type) {
      return NextResponse.json({ error: 'agent_user_id, title, duration, and type are required' }, { status: 400 })
    }

    // Calculate start and end times based on current time in Philippine timezone
    const now = new Date()
    const startTime = now.toISOString()
    const endTime = new Date(now.getTime() + duration * 60000).toISOString()

    const query = `
      INSERT INTO meetings (agent_user_id, title, description, start_time, end_time, duration_minutes, meeting_type, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `

    const result = await executeQuery(query, [
      agent_user_id,
      title,
      description || '',
      startTime,
      endTime,
      duration,
      type,
      'scheduled'
    ])

    return NextResponse.json({
      success: true,
      meeting: result[0]
    })
  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json({ error: 'Failed to create meeting' }, { status: 500 })
  }
} 