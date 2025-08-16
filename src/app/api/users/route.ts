import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

function getUserFromRequest(request: NextRequest) {
  const authCookie = request.cookies.get('shoreagents-auth')
  if (!authCookie) return null
  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) return null
    return authData.user
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  let pool: Pool | null = null
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const search = (url.searchParams.get('q') || '').trim()
    const limitParam = Number(url.searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(limitParam, 1), 200)

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    try {
      const parts: string[] = []
      const params: any[] = []
      let p = 1
      if (search) {
        parts.push(`(LOWER(u.email) LIKE $${p} OR LOWER(COALESCE(pi.first_name,'') || ' ' || COALESCE(pi.last_name,'')) LIKE $${p})`)
        params.push(`%${search.toLowerCase()}%`)
        p++
      }
      params.push(limit)

      const query = `
        SELECT 
          u.id,
          u.email,
          TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as name,
          COALESCE(pi.profile_picture, '') as avatar
        FROM users u
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        ${parts.length > 0 ? 'WHERE ' + parts.join(' AND ') : ''}
        ORDER BY (TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,'')))) NULLS LAST, u.email
        LIMIT $${p}
      `

      const res = await client.query(query, params)
      return NextResponse.json({ success: true, users: res.rows })
    } finally {
      client.release()
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to load users' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}


