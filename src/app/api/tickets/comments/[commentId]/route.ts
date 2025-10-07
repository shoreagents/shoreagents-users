import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

function getUserFromRequest(request: NextRequest) {
  const cookie = request.cookies.get('shoreagents-auth')
  if (!cookie) return null
  try {
    const raw = typeof cookie.value === 'string' ? cookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const auth = JSON.parse(decoded)
    if (!auth?.isAuthenticated || !auth.user) return null
    return auth.user
  } catch {
    return null
  }
}

// PUT: update a comment (only author or admin)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const content: string = (body?.comment || '').toString().trim()
    if (!content) return NextResponse.json({ success: false, error: 'Comment is required' }, { status: 400 })

    const client = await getDatabaseClient()
    try {
      // Locate user id
      const userRes = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [user.email])
      if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 })
      const currentUserId = userRes.rows[0].id
      const isAdmin = (user.role === 'admin')

      // Check ownership (support both UUID and integer by comparing as text)
      const { commentId } = await params
      const existing = await client.query('SELECT user_id FROM ticket_comments WHERE id::text = $1', [commentId])
      if (existing.rows.length === 0) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 })
      if (!isAdmin && existing.rows[0].user_id !== currentUserId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      const upd = await client.query(
        `UPDATE ticket_comments
         SET comment = $1
         WHERE id::text = $2
         RETURNING id,
                   comment,
                   to_char(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00' as updated_at_ph`,
        [content, commentId]
      )
      return NextResponse.json({ success: true, comment: upd.rows[0] })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error('PUT /api/tickets/comments/:id error:', e?.message || e)
    return NextResponse.json({ success: false, error: 'Failed to update comment', details: e?.message || String(e) }, { status: 500 })
  }
}

// DELETE: delete a comment (only author or admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.email) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const client = await getDatabaseClient()
    try {
      const userRes = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [user.email])
      if (userRes.rows.length === 0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 401 })
      const currentUserId = userRes.rows[0].id
      const isAdmin = (user.role === 'admin')

      const { commentId } = await params
      const existing = await client.query('SELECT user_id FROM ticket_comments WHERE id::text = $1', [commentId])
      if (existing.rows.length === 0) return NextResponse.json({ success: false, error: 'Comment not found' }, { status: 404 })
      if (!isAdmin && existing.rows[0].user_id !== currentUserId) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }

      await client.query('DELETE FROM ticket_comments WHERE id::text = $1', [commentId])
      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (e: any) {
    console.error('DELETE /api/tickets/comments/:id error:', e?.message || e)
    return NextResponse.json({ success: false, error: 'Failed to delete comment', details: e?.message || String(e) }, { status: 500 })
  }
}


