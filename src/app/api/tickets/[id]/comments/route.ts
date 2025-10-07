import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// Helper: parse auth cookie
function getUserFromRequest(request: NextRequest) {
  const cookie = request.cookies.get('shoreagents-auth')
  if (!cookie) return null
  try {
    const raw = typeof cookie.value === 'string' ? cookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const auth = JSON.parse(decoded)
    if (!auth?.isAuthenticated || !auth.user) return null
    return auth.user
  } catch {
    return null
  }
}

async function getTicketRowId(idParam: string): Promise<number | null> {
  // First try by public ticket_id (string)
  const byTicketId = await executeQuery('SELECT id FROM tickets WHERE ticket_id = $1 LIMIT 1', [idParam])
  if (byTicketId.length > 0) return byTicketId[0].id
  // Next, if numeric, try by internal id
  const asNum = Number(idParam)
  if (Number.isFinite(asNum)) {
    const byId = await executeQuery('SELECT id FROM tickets WHERE id = $1 LIMIT 1', [asNum])
    if (byId.length > 0) return byId[0].id
  }
  return null
}

// GET: list comments for a ticket
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ticketId = (await params).id
    
    // Get ticket row ID using shared connection
    const ticketRowId = await getTicketRowId(ticketId)
    if (!ticketRowId) {
      return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
    }

    // Check if this is a real-time update request (bypass cache)
    const url = new URL(request.url)
    const bypassCache = url.searchParams.get('bypass_cache') === 'true'
    
    // Check Redis cache first (unless bypassing)
    const cacheKey = cacheKeys.ticketComments(ticketId)
    let cachedData = null
    
    if (!bypassCache) {
      cachedData = await redisCache.get(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData)
      }
    } 

    const q = `
      SELECT c.id,
             c.user_id,
             c.comment,
             to_char(c.created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00' as created_at_ph,
             u.email,
             u.user_type,
             COALESCE(pi.first_name,'') AS first_name,
             COALESCE(pi.last_name,'') AS last_name,
             COALESCE(pi.profile_picture,'') AS profile_picture
      FROM ticket_comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      WHERE c.ticket_id = $1
      ORDER BY c.created_at ASC
    `
    const res = await executeQuery(q, [ticketRowId])
    const items = res.map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      content: r.comment,
      createdAt: r.created_at_ph,
      authorName: `${(r.first_name || '').trim()} ${(r.last_name || '').trim()}`.trim() || r.email,
      authorEmail: r.email,
      userType: r.user_type,
      profilePicture: r.profile_picture || '',
    }))

    const responseData = { success: true, comments: items }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.ticketComments)

    return NextResponse.json(responseData)
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
  }
}

// POST: add comment to a ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user?.email) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const content: string = (body?.comment || '').toString().trim()
    if (!content) {
      return NextResponse.json({ success: false, error: 'Comment is required' }, { status: 400 })
    }

    const client = await getDatabaseClient()
    try {
      const ticketRowId = await getTicketRowId((await params).id)
      if (!ticketRowId) {
        return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 })
      }

      // Ensure user exists; fetch id by email
      const userRes = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [user.email])
      let userId: number
      if (userRes.rows.length === 0) {
        const created = await client.query(
          `INSERT INTO users (email, name, user_type, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
          [user.email, user.name || user.email, user.user_type || 'agent']
        )
        userId = created.rows[0].id
      } else {
        userId = userRes.rows[0].id
      }

      const insert = await client.query(
        `INSERT INTO ticket_comments (ticket_id, user_id, comment, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING id, to_char(created_at AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD"T"HH24:MI:SS.MS') || '+08:00' as created_at_ph`,
        [ticketRowId, userId, content]
      )

      const created = insert.rows[0]
      const authorName = user.name || user.email
      
      // Invalidate comments cache for this ticket
      const ticketId = (await params).id
      const cacheKey = cacheKeys.ticketComments(ticketId)
      await redisCache.del(cacheKey)
      
      return NextResponse.json({
        success: true,
        comment: {
          id: created.id,
          userId,
          content,
          createdAt: created.created_at_ph,
          authorName,
          authorEmail: user.email,
        },
      })
    } finally {
      client.release()
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: 'Failed to post comment' }, { status: 500 })
  }
}


