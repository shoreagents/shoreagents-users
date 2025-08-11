import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { getCurrentUserInfo } from '@/lib/user-profiles'

// POST /api/meetings/start - Start a meeting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { meetingId } = body

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 })
    }

    // Use the database function to start the meeting
    const query = `SELECT start_meeting($1)`
    const result = await executeQuery(query, [meetingId])

    if (result[0]?.start_meeting === false) {
      return NextResponse.json({ error: 'Failed to start meeting. Meeting may not exist or is not in scheduled status.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Meeting started successfully'
    })
  } catch (error) {
    console.error('Error starting meeting:', error)
    return NextResponse.json({ error: 'Failed to start meeting' }, { status: 500 })
  }
} 