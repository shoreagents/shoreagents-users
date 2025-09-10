import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

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

// PUT /api/events/[id] - Update an event (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const eventId = parseInt(params.id)
    const body = await request.json()
    const { title, description, event_date, start_time, end_time, location, status, event_type, assigned_user_ids } = body

    // Validate required fields
    if (!title || !event_date || !start_time || !end_time) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    // Validate assigned_user_ids if provided
    if (assigned_user_ids && !Array.isArray(assigned_user_ids)) {
      return NextResponse.json({ success: false, message: 'assigned_user_ids must be an array' }, { status: 400 })
    }

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Get user ID and verify admin status
      const userQuery = `SELECT id FROM users WHERE email = $1 AND user_type = 'Internal'`
      const userResult = await client.query(userQuery, [currentUser.email])
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'User not found or not authorized to update events' }, { status: 403 })
      }
      
      // Update event using direct SQL with Philippines timezone
      const updateQuery = `
        UPDATE events 
        SET 
          title = $1,
          description = $2,
          event_date = $3,
          start_time = $4,
          end_time = $5,
          location = $6,
          status = $7,
          event_type = $8,
          assigned_user_ids = $9,
          updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
        WHERE id = $10
        RETURNING id
      `
      
      const result = await client.query(updateQuery, [
        title,
        description || '',
        event_date,
        start_time,
        end_time,
        location || '',
        status || 'upcoming',
        event_type || 'event',
        assigned_user_ids || null,
        eventId
      ])
      
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error in PUT /api/events/[id]:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}

// DELETE /api/events/[id] - Delete an event (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const eventId = parseInt(params.id)

    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      // Get user ID and verify admin status
      const userQuery = `SELECT id FROM users WHERE email = $1 AND user_type = 'Internal'`
      const userResult = await client.query(userQuery, [currentUser.email])
      
      if (userResult.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'User not found or not authorized to delete events' }, { status: 403 })
      }
      
      // Delete event using direct SQL (cascade will handle attendance records)
      const deleteQuery = `DELETE FROM events WHERE id = $1 RETURNING id`
      
      const result = await client.query(deleteQuery, [eventId])
      
      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Event not found' }, { status: 404 })
      }

      return NextResponse.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error in DELETE /api/events/[id]:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  } finally {
    if (pool) await pool.end()
  }
}
