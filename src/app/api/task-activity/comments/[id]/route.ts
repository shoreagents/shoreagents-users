import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

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

    const pool = getPool()
    // Only owner or admin can edit
    const check = await pool.query('SELECT user_id FROM task_comments WHERE id::text = $1', [id])
    if (check.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const ownerId = Number(check.rows[0].user_id)
    const isAdmin = ['admin','superadmin'].includes(String(user.role||'').toLowerCase())
    if (ownerId !== Number(user.id) && !isAdmin) {
      await pool.end()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const upd = await pool.query(
      `UPDATE task_comments SET content = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila' WHERE id::text = $2
       RETURNING id::text, task_id, user_id, content,
         (created_at AT TIME ZONE 'Asia/Manila') AS created_at,
         (updated_at AT TIME ZONE 'Asia/Manila') AS updated_at`,
      [content, id]
    )
    await pool.end()
    return NextResponse.json({ success: true, comment: upd.rows[0] })
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

    const pool = getPool()
    const check = await pool.query('SELECT user_id FROM task_comments WHERE id::text = $1', [id])
    if (check.rows.length === 0) { await pool.end(); return NextResponse.json({ success: true }) }
    const ownerId = Number(check.rows[0].user_id)
    const isAdmin = ['admin','superadmin'].includes(String(user.role||'').toLowerCase())
    if (ownerId !== Number(user.id) && !isAdmin) {
      await pool.end()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await pool.query('DELETE FROM task_comments WHERE id::text = $1', [id])
    await pool.end()
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('DELETE task comment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


