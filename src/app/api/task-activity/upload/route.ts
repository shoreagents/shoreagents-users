import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client with service role key
let supabaseAdmin: any = null

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  
  return supabaseAdmin
}

function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => {
      try { return decodeURIComponent(raw) } catch { return raw }
    })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    return {
      id: authData.user.railway_id || authData.user.id,
      email: authData.user.email,
      name: authData.user.name,
      role: authData.user.role,
      user_type: authData.user.user_type,
    }
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not found' }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const taskId = formData.get('taskId') as string

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 })
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    const MAX_BYTES = 5 * 1024 * 1024 // 5MB
    const uploadedFiles: Array<{ id?: number; name: string; url: string; size: number; type: string; path: string; position?: number }> = []
    const rejected: Array<{ name: string; reason: string }> = []

    for (const file of files) {
      try {
        if (file.size > MAX_BYTES) {
          rejected.push({ name: file.name, reason: 'File exceeds 5MB limit' })
          continue
        }

        const timestamp = Date.now()
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const fileName = `${taskId}/${timestamp}-${safeName}`
        const filePath = `attachments/${fileName}`

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const admin = getSupabaseAdmin()
        const { error } = await admin.storage
          .from('tasks')
          .upload(filePath, buffer, {
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
            upsert: false,
          })

        if (error) {
          rejected.push({ name: file.name, reason: error.message })
          continue
        }

        const { data: urlData } = admin.storage
          .from('tasks')
          .getPublicUrl(filePath)

        uploadedFiles.push({
          name: file.name,
          url: urlData.publicUrl,
          size: file.size,
          type: file.type,
          path: filePath,
        })
      } catch (e: any) {
        rejected.push({ name: file.name, reason: e?.message || 'Upload failed' })
        continue
      }
    }

    // Persist attachments to Postgres with positions
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })

    // Verify user has access to the task (creator OR assignee)
    const taskRes = await pool.query(
      `SELECT t.id, t.user_id as creator_id,
              EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
       FROM tasks t WHERE t.id = $1`,
      [taskId, user.id]
    )
    if (taskRes.rows.length === 0) {
      await pool.end()
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    
    const taskPermission = taskRes.rows[0]
    const isCreator = Number(taskPermission.creator_id) === Number(user.id)
    const isAssignee = taskPermission.is_assignee
    
    if (!isCreator && !isAssignee) {
      await pool.end()
      return NextResponse.json({ error: 'You do not have permission to modify this task' }, { status: 403 })
    }

    const client = await pool.connect()
    const inserted: typeof uploadedFiles = []
    try {
      await client.query('BEGIN')
      for (const f of uploadedFiles) {
        const posRes = await client.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM task_attachments WHERE task_id = $1', [taskId])
        const nextPos = posRes.rows[0].next_pos
        const ins = await client.query(
          `INSERT INTO task_attachments (task_id, name, url, type, size, position, path)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, task_id, name, url, type, size, position, path`,
          [taskId, f.name, f.url, f.type, f.size, nextPos, f.path]
        )
        inserted.push({ ...f, id: ins.rows[0].id, position: ins.rows[0].position })
      }
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
      await pool.end()
    }

    return NextResponse.json({ success: true, files: inserted, rejected })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


