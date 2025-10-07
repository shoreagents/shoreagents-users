import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    return {
      id: authData.user.railway_id || authData.user.id,
      email: authData.user.email,
    }
  } catch {
    return null
  }
}

// Reorder attachments by positions (used for setting cover by promoting to position 0)
export async function PATCH(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { task_id, ordered_ids } = await request.json()
    if (!task_id || !Array.isArray(ordered_ids)) {
      return NextResponse.json({ error: 'task_id and ordered_ids are required' }, { status: 400 })
    }

    // Verify task ownership
    const own = await executeQuery('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [task_id, user.id])
    if (own.length === 0) {
      return NextResponse.json({ error: 'Task not found or not owned by user' }, { status: 404 })
    }

    const client = await getDatabaseClient()
    try {
      await client.query('BEGIN')
      for (let i = 0; i < ordered_ids.length; i++) {
        await client.query(
          "UPDATE task_attachments SET position = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila' WHERE id = $2 AND task_id = $3",
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

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to reorder attachments' }, { status: 500 })
  }
}


