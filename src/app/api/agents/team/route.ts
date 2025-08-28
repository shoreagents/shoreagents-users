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
    
    // Handle both hybrid and regular auth structures
    let userId = authData.user.id
    
    // If it's a hybrid auth system, use railway_id if available
    if (authData.hybrid && authData.user.railway_id) {
      userId = authData.user.railway_id
    }
    
    // Ensure we have a valid numeric ID
    if (!userId || isNaN(Number(userId))) {
      console.error('Invalid user ID:', userId)
      return null
    }
    
    return {
      ...authData.user,
      id: Number(userId)
    }
  } catch (error) {
    console.error('Error parsing auth cookie:', error)
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
    
    if (!user.email) {
      return NextResponse.json({ success: false, error: 'User email not found' }, { status: 400 })
    }
    
    const url = new URL(request.url)
    const search = (url.searchParams.get('q') || '').trim()
    const limitParam = Number(url.searchParams.get('limit') || '50')
    const limit = Math.min(Math.max(limitParam, 1), 200)

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    try {
      // First, get the current user's member_id using email instead of user_id
      const currentUserQuery = `
        SELECT a.member_id
        FROM agents a
        INNER JOIN users u ON a.user_id = u.id
        WHERE u.email = $1
      `
      const currentUserResult = await client.query(currentUserQuery, [user.email])
      
      if (currentUserResult.rows.length === 0) {
        return NextResponse.json({ success: false, error: 'User is not an agent' }, { status: 400 })
      }
      
      const currentUserMemberId = currentUserResult.rows[0].member_id
      
      // Now fetch all agents from the same team/company
      const parts: string[] = []
      const params: any[] = []
      let p = 1
      
      // Always filter by the same member_id (team/company)
      parts.push(`a.member_id = $${p}`)
      params.push(currentUserMemberId)
      p++
      
      // Add search filter if provided
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
          COALESCE(pi.profile_picture, '') as avatar,
          a.member_id,
          m.company as team_name
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        INNER JOIN members m ON a.member_id = m.id
        LEFT JOIN personal_info pi ON pi.user_id = u.id
        WHERE ${parts.join(' AND ')}
        ORDER BY (TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,'')))) NULLS LAST, u.email
        LIMIT $${p}
      `

      const res = await client.query(query, params)
      
      // Get team info for the response
      const teamQuery = `
        SELECT company, badge_color
        FROM members
        WHERE id = $1
      `
      const teamResult = await client.query(teamQuery, [currentUserMemberId])
      const teamInfo = teamResult.rows[0] || {}
      
      return NextResponse.json({ 
        success: true, 
        agents: res.rows,
        team: {
          member_id: currentUserMemberId,
          company: teamInfo.company,
          badge_color: teamInfo.badge_color
        }
      })
    } finally {
      client.release()
    }
  } catch (e) {
    console.error('Error fetching team agents:', e)
    return NextResponse.json({ success: false, error: 'Failed to load team agents' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}
