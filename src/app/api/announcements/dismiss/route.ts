import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseClient } from '@/lib/database-server'

// POST /api/announcements/dismiss - Dismiss an announcement for a user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { announcement_id, user_id, dismissal_reason = 'user_dismissed', client_info } = body

    if (!announcement_id || !user_id) {
      return NextResponse.json(
        { error: 'Announcement ID and User ID are required' },
        { status: 400 }
      )
    }

    const client = await getDatabaseClient()
    
    try {
      await client.query('BEGIN')

      // Call the dismiss_announcement function
      await client.query(
        'SELECT dismiss_announcement($1, $2, $3)',
        [announcement_id, user_id, dismissal_reason]
      )

      // Client info is no longer stored since we removed the dismissals table
      // The dismiss_announcement function handles the dismissal

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Announcement dismissed successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error dismissing announcement:', error)
    return NextResponse.json(
      { error: 'Failed to dismiss announcement' },
      { status: 500 }
    )
  }
}
