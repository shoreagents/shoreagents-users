import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

// Helper function to get user from request (matches pattern from other APIs)
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

// GET /api/events - Get all events for the current user
export async function GET(request: NextRequest) {
  let pool: Pool | null = null
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser?.email) {
      return NextResponse.json({ success: false, message: 'User not authenticated' }, { status: 401 })
    }
    
    console.log('Current user in events API:', currentUser)

    // Check if this is a real-time update request (bypass cache)
    const url = new URL(request.url)
    const bypassCache = url.searchParams.get('bypass_cache') === 'true'
    
    // Check Redis cache first (unless bypassing)
    const cacheKey = cacheKeys.events(currentUser.email)
    let cachedData = null
    
    if (!bypassCache) {
      cachedData = await redisCache.get(cacheKey)
      if (cachedData) {
        console.log('✅ Events served from Redis cache')
        return NextResponse.json(cachedData)
      }
    } else {
      console.log('🔄 Bypassing Redis cache for real-time update')
    }

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Get events with attendance for the current user using direct SQL with timezone conversion
      const query = `
        SELECT 
          e.id as event_id,
          e.title,
          e.description,
          e.event_date AT TIME ZONE 'Asia/Manila' as event_date,
          e.start_time,
          e.end_time,
          e.location,
          e.status,
          e.event_type,
          u.email as created_by_name,
          COALESCE(ea.is_going, false) as is_going,
          COALESCE(ea.is_back, false) as is_back,
          ea.going_at AT TIME ZONE 'Asia/Manila' as going_at,
          ea.back_at AT TIME ZONE 'Asia/Manila' as back_at
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = (
          SELECT id FROM users WHERE email = $1
        )
        ORDER BY e.event_date ASC, e.start_time ASC
      `
      
      const result = await client.query(query, [currentUser.email])
      
      console.log('Database response:', { rowCount: result.rowCount })

      const responseData = { success: true, events: result.rows || [] }

      // Cache the result in Redis
      await redisCache.set(cacheKey, responseData, cacheTTL.events)
      console.log('✅ Events cached in Redis')

      return NextResponse.json(responseData)
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error in GET /api/events:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}

// POST /api/events - Create a new event (admin only)
export async function POST(request: NextRequest) {
  let pool: Pool | null = null
  try {
    const currentUser = getUserFromRequest(request)
    if (!currentUser?.email) {
      return NextResponse.json({ success: false, message: 'User not authenticated' }, { status: 401 })
    }

    // Check if user is admin
    if (currentUser.user_type !== 'Internal') {
      return NextResponse.json({ success: false, message: 'Unauthorized - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { title, description, event_date, start_time, end_time, location, status, event_type } = body

    // Validate required fields
    if (!title || !event_date || !start_time || !end_time) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Get user ID and verify admin status
      const userQuery = `SELECT id FROM users WHERE email = $1 AND user_type = 'Internal'`
      const userResult = await client.query(userQuery, [currentUser.email])
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'User not found or not authorized to create events' }, { status: 403 })
      }
      
      const userId = userResult.rows[0].id
      
      // Create event using direct SQL with Philippines timezone
      const createQuery = `
        INSERT INTO events (title, description, event_date, start_time, end_time, location, event_type, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
        RETURNING id
      `
      
      const result = await client.query(createQuery, [
        title,
        description || '',
        event_date,
        start_time,
        end_time,
        location || '',
        event_type || 'event',
        userId
      ])
      
      const eventId = result.rows[0].id
      
      // Invalidate Redis cache for events
      await redisCache.del(cacheKeys.events(currentUser.email))
      console.log('✅ Events cache invalidated after event creation')
      
      return NextResponse.json({ success: true, event_id: eventId })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error in POST /api/events:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}
