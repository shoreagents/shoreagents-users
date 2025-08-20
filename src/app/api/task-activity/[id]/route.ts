import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const email = searchParams.get('email')
    const hard = searchParams.get('hard')
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Task id is required' }, { status: 400 })
    }

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 })
    }

    const pool = getPool()
    let actualUserId: number

    if (userId) {
      actualUserId = parseInt(userId)
    } else {
      const res = await pool.query('SELECT id FROM users WHERE email = $1', [email])
      if (res.rows.length === 0) {
        await pool.end()
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      actualUserId = res.rows[0].id
    }

    // Check if user has access to the task (creator OR assignee)
    const taskRes = await pool.query(
      `SELECT t.id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM tasks t WHERE t.id = $1`,
      [parseInt(id), actualUserId]
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
      return NextResponse.json({ error: 'You do not have permission to delete this task' }, { status: 403 })
    }

    let result
    if (hard && /^(1|true)$/i.test(hard)) {
      // Before hard delete, collect attachment file paths to purge from Supabase
      const attRows = await pool.query(
        `SELECT path FROM task_attachments WHERE task_id = $1`,
        [parseInt(id)]
      )
      const filePaths: string[] = (attRows.rows || [])
        .map((r: any) => String(r.path || ''))
        .filter(Boolean)

      // Hard delete the task and attachments in DB
      await pool.query('DELETE FROM task_attachments WHERE task_id = $1', [parseInt(id)])
      const q = `DELETE FROM tasks WHERE id = $1` // Removed user_id restriction
      result = await pool.query(q, [parseInt(id)])

      // Fire-and-forget remove from Supabase storage (best effort)
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey)
          // Our tasks use bucket 'tasks' with prefix 'attachments/{taskId}/...'
          const toStoragePath = (p: string) => {
            if (!p) return ''
            // Already storage key
            if (p.startsWith('attachments/')) return p
            // Strip full public URL prefix if present
            const cleaned = p.replace(/^https?:\/\/[^/]+\/storage\/v1\/object\/public\/tasks\//, '')
            return cleaned
          }
          const keys = (filePaths || []).map(toStoragePath).filter(Boolean)
          if (keys.length) {
            await sb.storage.from('tasks').remove(keys)
          }
          // Also remove any remaining files under the folder attachments/{id}
          const prefix = `attachments/${id}`
          const { data: list } = await sb.storage.from('tasks').list(prefix, { limit: 1000 })
          if (list && list.length) {
            const toDelete = list.map((f: any) => `${prefix}/${f.name}`)
            await sb.storage.from('tasks').remove(toDelete)
          }
        }
      } catch (e) {
        console.error('Supabase storage cleanup failed:', e)
      }
    } else {
      // Soft delete the task (keep history)
      const q = `
        UPDATE tasks
        SET status = 'deleted', updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE id = $1
        RETURNING id
      `
      result = await pool.query(q, [parseInt(id)])
    }
    await pool.end()

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


