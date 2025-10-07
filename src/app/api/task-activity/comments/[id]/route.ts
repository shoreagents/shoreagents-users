import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

function getUserFromRequest(req: NextRequest) {
  try {
    const cookie = req.headers.get('cookie') || ''
    const match = cookie.match(/(?:^|; )shoreagents-auth=([^;]+)/)
    if (!match) return null
    const decoded = decodeURIComponent(match[1])
    const data = JSON.parse(decoded)
    if (!data?.user) return null
    const user = data.user
    const id = data.hybrid && user.railway_id ? Number(user.railway_id) : Number(user.id)
    return { id, email: user.email, role: user.role || user.user_type }
  } catch {
    return null
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params
    const body = await request.json()
    const content = (body?.content ?? body?.comment ?? '').trim()
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 })

    // Only owner or admin can edit
    const check = await executeQuery('SELECT user_id FROM task_comments WHERE id::text = $1', [id])
    if (check.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const ownerId = Number(check[0].user_id)
    const isAdmin = ['admin','superadmin'].includes(String(user.role||'').toLowerCase())
    if (ownerId !== Number(user.id) && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const upd = await executeQuery(
      `UPDATE task_comments SET content = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila' WHERE id::text = $2
       RETURNING id::text, task_id, user_id, content,
         (created_at AT TIME ZONE 'Asia/Manila') AS created_at,
         (updated_at AT TIME ZONE 'Asia/Manila') AS updated_at`,
      [content, id]
    )
    return NextResponse.json({ success: true, comment: upd[0] })
  } catch (e) {
    console.error('PUT task comment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await context.params

    const check = await executeQuery('SELECT user_id FROM task_comments WHERE id::text = $1', [id])
    if (check.length === 0) { return NextResponse.json({ success: true }) }
    const ownerId = Number(check[0].user_id)
    const isAdmin = ['admin','superadmin'].includes(String(user.role||'').toLowerCase())
    if (ownerId !== Number(user.id) && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await executeQuery('DELETE FROM task_comments WHERE id::text = $1', [id])
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE task comment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


