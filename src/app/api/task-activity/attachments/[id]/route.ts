import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function getUserIdFromCookie(req: NextRequest): number | null {
  try {
    const c = req.cookies.get('shoreagents-auth')?.value
    if (!c) return null
    const decoded = (() => { try { return decodeURIComponent(c) } catch { return c } })()
    const parsed = JSON.parse(decoded)
    return parsed?.user?.railway_id || parsed?.user?.id || null
  } catch {
    return null
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = getUserIdFromCookie(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    const attId = parseInt(id, 10)
    if (!Number.isFinite(attId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    // Ensure ownership and fetch path
    const rowRes = await pool.query(
      `SELECT ta.path, ta.url, ta.task_id
       FROM task_attachments ta
       JOIN tasks t ON t.id = ta.task_id
       WHERE ta.id = $1 AND t.user_id = $2`,
      [attId, userId]
    )
    if (rowRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }
    const { path } = rowRes.rows[0]

    // Delete from storage first (ignore if missing)
    if (path) {
      await supabaseAdmin.storage.from('tasks').remove([path])
    }

    // Delete DB row
    await pool.query('DELETE FROM task_attachments WHERE id = $1', [attId])
    await pool.end()

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to delete attachment' }, { status: 500 })
  }
}


