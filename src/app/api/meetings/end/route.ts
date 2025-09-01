import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

// POST /api/meetings/end - End a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    // Use the database function to end the meeting
    const query = `SELECT end_meeting($1)`
    const result = await executeQuery(query, [meetingId])

    if (result[0]?.end_meeting === false) {
      return NextResponse.json({ error: 'Failed to end meeting. Meeting may not exist or is not in progress.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Meeting ended successfully'
    })
  } catch (error) {
    console.error('Error ending meeting:', error)
    return NextResponse.json({ error: 'Failed to end meeting' }, { status: 500 })
  }
} 