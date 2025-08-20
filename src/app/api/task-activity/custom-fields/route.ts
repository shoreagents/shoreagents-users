import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function POST(request: NextRequest) {
  // Create a custom field
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userIdParam = searchParams.get('userId')

    if (!email && !userIdParam) {
      return NextResponse.json({ error: 'email or userId is required' }, { status: 400 })
    }

    const { task_id, title, description } = await request.json()
    if (!task_id) {
      return NextResponse.json({ error: 'task_id is required' }, { status: 400 })
    }

    const pool = getPool()
    let actualUserId: number
    if (userIdParam) {
      actualUserId = parseInt(userIdParam)
    } else {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email])
      if (userRes.rows.length === 0) {
        await pool.end()
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      actualUserId = userRes.rows[0].id
    }

    // Ensure the user has access to the task (creator OR assignee)
    const taskRes = await pool.query(
      `SELECT t.id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM tasks t WHERE t.id = $1`,
      [task_id, actualUserId]
    )
    if (taskRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    const taskPermission = taskRes.rows[0]
    const isCreator = Number(taskPermission.creator_id) === Number(actualUserId)
    const isAssignee = taskPermission.is_assignee
    
    if (!isCreator && !isAssignee) {
      await pool.end()
      return NextResponse.json({ error: 'You do not have permission to modify this task' }, { status: 403 })
    }

    const posRes = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM task_custom_fields WHERE task_id = $1', [task_id])
    const nextPos = posRes.rows[0].next_pos

    const insertRes = await pool.query(
      `INSERT INTO task_custom_fields (task_id, title, description, position)
       VALUES ($1, $2, $3, $4)
       RETURNING id, task_id, title, description, position, created_at, updated_at`,
      [task_id, (title ?? ''), (description ?? ''), nextPos]
    )

    await pool.end()
    return NextResponse.json({ success: true, field: insertRes.rows[0] })
  } catch (e) {
    console.error('Create custom field error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  // Reorder fields
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userIdParam = searchParams.get('userId')
    const { task_id, ordered_ids } = await request.json()

    if (!task_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json({ error: 'task_id and ordered_ids are required' }, { status: 400 })
    }

    const pool = getPool()
    let actualUserId: number
    if (userIdParam) {
      actualUserId = parseInt(userIdParam)
    } else {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email])
      if (userRes.rows.length === 0) {
        await pool.end()
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      actualUserId = userRes.rows[0].id
    }

    // Ensure the user has access to the task (creator OR assignee)
    const taskRes = await pool.query(
      `SELECT t.id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM tasks t WHERE t.id = $1`,
      [task_id, actualUserId]
    )
    if (taskRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    const taskPermission = taskRes.rows[0]
    const isCreator = Number(taskPermission.creator_id) === Number(actualUserId)
    const isAssignee = taskPermission.is_assignee
    
    if (!isCreator && !isAssignee) {
      await pool.end()
      return NextResponse.json({ error: 'You do not have permission to modify this task' }, { status: 403 })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < ordered_ids.length; i++) {
        await client.query(
          "UPDATE task_custom_fields SET position = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila' WHERE id = $2 AND task_id = $3",
          [i, ordered_ids[i], task_id]
        )
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await pool.end()
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Reorder custom fields error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


