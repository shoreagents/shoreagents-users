import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

// GET /api/announcements - Get announcements for current user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')
    const includeDismissed = searchParams.get('include_dismissed') === 'true'

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    let query = `
      SELECT 
        a.id as announcement_id,
        a.title,
        a.message,
        a.priority,
        a.allow_dismiss,
        a.created_at,
        a.sent_at,
        (aa.dismissed_at IS NOT NULL) as is_dismissed,
        aa.dismissed_at
      FROM public.announcements a
      JOIN public.announcement_assignments aa ON a.id = aa.announcement_id
      WHERE aa.user_id = $1
        AND a.status = 'active'
        AND (a.expires_at IS NULL OR a.expires_at > now())
    `

    if (!includeDismissed) {
      query += ' AND aa.dismissed_at IS NULL'
    }

    query += ' ORDER BY a.priority DESC, a.sent_at DESC'

    const result = await executeQuery(query, [userId])
    
    return NextResponse.json({
      success: true,
      announcements: result
    })
  } catch (error) {
    console.error('Error fetching announcements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch announcements' },
      { status: 500 }
    )
  }
}

// POST /api/announcements - Create new announcement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      message,
      priority = 'medium',
      assigned_user_ids,
      scheduled_at,
      expires_at,
      allow_dismiss = true,
      created_by
    } = body

    if (!title || !message || !created_by || !assigned_user_ids) {
      return NextResponse.json(
        { error: 'Title, message, created_by, and assigned_user_ids are required' },
        { status: 400 }
      )
    }

    const client = await getDatabaseClient()
    
    try {
      await client.query('BEGIN')

      // Insert announcement
      const announcementResult = await client.query(`
        INSERT INTO public.announcements (
          title, message, priority, status,
          assigned_user_ids, scheduled_at, expires_at,
          allow_dismiss, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        title, message, priority,
        scheduled_at ? 'scheduled' : 'draft',
        assigned_user_ids, scheduled_at, expires_at,
        allow_dismiss, created_by
      ])

      const announcementId = announcementResult.rows[0].id

      // Create assignments
      await client.query('SELECT create_announcement_assignments($1)', [announcementId])

      // If not scheduled, send immediately
      if (!scheduled_at) {
        await client.query('SELECT send_announcement($1)', [announcementId])
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        announcement_id: announcementId,
        message: scheduled_at ? 'Announcement scheduled successfully' : 'Announcement sent successfully'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating announcement:', error)
    return NextResponse.json(
      { error: 'Failed to create announcement' },
      { status: 500 }
    )
  }
}
