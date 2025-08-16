import { NextRequest, NextResponse } from 'next/server'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userIdParam = searchParams.get('userId')
    const { id } = await context.params
    const fieldId = parseInt(id)
    const { title, description } = await request.json()

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

    // Ensure field belongs to a task owned by user
    const ownRes = await pool.query(
      `SELECT tcf.id FROM task_custom_fields tcf
       JOIN tasks t ON t.id = tcf.task_id
       WHERE tcf.id = $1 AND t.user_id = $2`,
      [fieldId, actualUserId]
    )
    if (ownRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Field not found or not owned by user' }, { status: 404 })
    }

    const updRes = await pool.query(
      `UPDATE task_custom_fields
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = NOW() AT TIME ZONE 'Asia/Manila'
       WHERE id = $3
       RETURNING id, task_id, title, description, position, created_at, updated_at`,
      [title ?? null, description ?? null, fieldId]
    )

    await pool.end()
    return NextResponse.json({ success: true, field: updRes.rows[0] })
  } catch (e) {
    console.error('Update custom field error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userIdParam = searchParams.get('userId')
    const { id } = await context.params
    const fieldId = parseInt(id)

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

    // Ensure field belongs to a task owned by user
    const ownRes = await pool.query(
      `SELECT tcf.task_id FROM task_custom_fields tcf
       JOIN tasks t ON t.id = tcf.task_id
       WHERE tcf.id = $1 AND t.user_id = $2`,
      [fieldId, actualUserId]
    )
    if (ownRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Field not found or not owned by user' }, { status: 404 })
    }
    const taskId = ownRes.rows[0].task_id

    // Delete field and recompact positions
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM task_custom_fields WHERE id = $1', [fieldId])
      const reorder = await client.query(
        `SELECT id FROM task_custom_fields WHERE task_id = $1 ORDER BY position ASC, id ASC`,
        [taskId]
      )
      for (let i = 0; i < reorder.rows.length; i++) {
        await client.query(
          `UPDATE task_custom_fields SET position = $1 WHERE id = $2`,
          [i, reorder.rows[i].id]
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
    console.error('Delete custom field error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


