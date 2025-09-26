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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const pool = getPool()
    const q = `
      SELECT 
        c.id::text,
        c.task_id,
        c.user_id,
        c.content,
        (c.created_at AT TIME ZONE 'Asia/Manila') AS created_at,
        (c.updated_at AT TIME ZONE 'Asia/Manila') AS updated_at,
        COALESCE(NULLIF(TRIM(COALESCE(pi.first_name,'') || ' ' || COALESCE(pi.last_name,'')), ''), u.email) AS author_name,
        u.email AS author_email,
        u.user_type,
        COALESCE(pi.profile_picture, '') AS profile_picture
      FROM task_comments c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      WHERE c.task_id = $1
      ORDER BY c.created_at ASC
    `
    const { rows } = await pool.query(q, [taskId])
    await pool.end()
    return NextResponse.json({ success: true, comments: rows })
  } catch (e) {
    console.error('GET task comments error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { taskId, content } = body || {}
    if (!taskId || !content || String(content).trim().length === 0) {
      return NextResponse.json({ error: 'taskId and content are required' }, { status: 400 })
    }

    const pool = getPool()
    const insert = `
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING id::text, task_id, user_id, content,
        (created_at AT TIME ZONE 'Asia/Manila') AS created_at,
        (updated_at AT TIME ZONE 'Asia/Manila') AS updated_at
    `
    const { rows } = await pool.query(insert, [taskId, user.id, String(content).trim()])
    const row = rows[0]
    await pool.end()
    return NextResponse.json({ success: true, comment: {
      ...row,
      author_name: null,
      author_email: user.email,
    }})
  } catch (e) {
    console.error('POST task comment error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


