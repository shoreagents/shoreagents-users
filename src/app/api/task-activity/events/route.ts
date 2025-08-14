import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('task_id')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '50', 10) || 50, 1), 200)
    if (!taskId) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
    }
    const pool = getPool()
    const rows = await pool.query(
      `SELECT id, task_id, actor_user_id, action, details, created_at
       FROM task_activity_events
       WHERE task_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [parseInt(taskId, 10), limit]
    )
    await pool.end()
    return NextResponse.json({ success: true, events: rows.rows })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


