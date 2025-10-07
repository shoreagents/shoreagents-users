import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const userIdParam = searchParams.get('userId')
    const { id } = await context.params
    const fieldId = parseInt(id)
    const { title, description } = await request.json()

    let actualUserId: number
    if (userIdParam) {
      actualUserId = parseInt(userIdParam)
    } else {
      const userRes = await executeQuery('SELECT id FROM users WHERE email = $1', [email])
      if (userRes.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      actualUserId = userRes[0].id
    }

    // Ensure user has access to the task (creator OR assignee)
    const ownRes = await executeQuery(
      `SELECT tcf.id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM task_custom_fields tcf
       JOIN tasks t ON t.id = tcf.task_id
       WHERE tcf.id = $1`,
      [fieldId, actualUserId]
    )
    if (ownRes.length === 0) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }
    
    const fieldPermission = ownRes[0]
    const isCreator = Number(fieldPermission.creator_id) === Number(actualUserId)
    const isAssignee = fieldPermission.is_assignee
    
    if (!isCreator && !isAssignee) {
      return NextResponse.json({ error: 'You do not have permission to modify this field' }, { status: 403 })
    }

    const updRes = await executeQuery(
      `UPDATE task_custom_fields
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = NOW() AT TIME ZONE 'Asia/Manila'
       WHERE id = $3
       RETURNING id, task_id, title, description, position, created_at, updated_at`,
      [title ?? null, description ?? null, fieldId]
    )

    return NextResponse.json({ success: true, field: updRes[0] })
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

    let actualUserId: number
    if (userIdParam) {
      actualUserId = parseInt(userIdParam)
    } else {
      const userRes = await executeQuery('SELECT id FROM users WHERE email = $1', [email])
      if (userRes.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      actualUserId = userRes[0].id
    }

    // Ensure user has access to the task (creator OR assignee)
    const ownRes = await executeQuery(
      `SELECT tcf.task_id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM task_custom_fields tcf
       JOIN tasks t ON t.id = tcf.task_id
       WHERE tcf.id = $1`,
      [fieldId, actualUserId]
    )
    if (ownRes.length === 0) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }
    
    const fieldPermission = ownRes[0]
    const isCreator = Number(fieldPermission.creator_id) === Number(actualUserId)
    const isAssignee = fieldPermission.is_assignee
    
    if (!isCreator && !isAssignee) {
      return NextResponse.json({ error: 'You do not have permission to delete this field' }, { status: 403 })
    }
    const taskId = ownRes[0].task_id

    // Delete field and recompact positions
    const client = await getDatabaseClient()
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

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Delete custom field error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


