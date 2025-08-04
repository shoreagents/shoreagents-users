import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { getCurrentPhilippinesTime } from '@/lib/timezone-utils'

// Database configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
  // Get user from cookies (adjust based on your auth system)
  const authCookie = request.cookies.get('shoreagents-auth')
  
  if (!authCookie) {
    return null
  }

  try {
    const authData = JSON.parse(authCookie.value)
    if (!authData.isAuthenticated || !authData.user) {
      return null
    }

    return {
      id: authData.user.id,
      email: authData.user.email,
      name: authData.user.name,
      role: authData.user.role,
      user_type: authData.user.user_type
    }
  } catch (error) {
    console.error('Error parsing auth cookie:', error)
    return null
  }
}

// Generate ticket ID
function generateTicketId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 9)
  return `TKT-${timestamp}-${random}`.toUpperCase()
}

// GET: Retrieve tickets for the authenticated user
export async function GET(request: NextRequest) {
  let pool: Pool | null = null
  
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Create database connection
    pool = new Pool(databaseConfig)
    const client = await pool.connect()

    try {
      // Get tickets for the user
      const ticketsQuery = `
        SELECT 
          t.id,
          t.ticket_id,
          t.user_id,
          t.concern,
          t.details,
          t.category,
          t.status,
          t.resolved_by,
          t.resolved_at,
          t.created_at,
          t.updated_at,
          t.position,
          u.email as user_email,
          resolver.email as resolved_by_email,
          COALESCE(
            array_agg(
              CASE 
                WHEN tf.file_name IS NOT NULL 
                THEN tf.file_name 
                ELSE NULL 
              END
            ) FILTER (WHERE tf.file_name IS NOT NULL), 
            ARRAY[]::text[]
          ) as files
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users resolver ON t.resolved_by = resolver.id
        LEFT JOIN ticket_files tf ON t.id = tf.ticket_id
        WHERE t.user_id = $1
        GROUP BY t.id, u.email, resolver.email
        ORDER BY t.position ASC, t.created_at DESC
      `

      const result = await client.query(ticketsQuery, [user.id])

      // Transform database results to match frontend interface
      const tickets = result.rows.map(row => ({
        id: row.ticket_id,
        name: row.concern,
        date: row.created_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || '',
        concern: row.concern,
        category: row.category,
        details: row.details || '',
        email: row.user_email,
        files: row.files || [],
        status: row.status,
        createdAt: row.created_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || '',
        userId: row.user_id,
        userEmail: row.user_email,
        resolvedBy: row.resolved_by,
        resolvedByEmail: row.resolved_by_email,
        resolvedAt: row.resolved_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || null,
        position: row.position
      }))

      return NextResponse.json({
        success: true,
        tickets,
        total: tickets.length
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('❌ Error fetching tickets:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch tickets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    if (pool) {
      await pool.end()
    }
  }
}

// POST: Create a new ticket
export async function POST(request: NextRequest) {
  let pool: Pool | null = null
  
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { concern, category, details, files = [] } = body

    // Validate required fields
    if (!concern || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: concern, category are required' },
        { status: 400 }
      )
    }

    // Create database connection
    pool = new Pool(databaseConfig)
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      // Generate ticket ID
      const ticketId = generateTicketId()

      // Get the next position value
      const positionResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM tickets'
      )
      const nextPosition = positionResult.rows[0].next_position

      // Insert ticket
      const insertTicketQuery = `
        INSERT INTO tickets (
          ticket_id, user_id, concern, details, 
          category, status, position, created_at, updated_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6::ticket_status_enum, $7,
                NOW() AT TIME ZONE 'Asia/Manila', 
                NOW() AT TIME ZONE 'Asia/Manila')
        RETURNING *
      `

      const ticketResult = await client.query(insertTicketQuery, [
        ticketId,
        user.id,
        concern,
        details || null,
        category,
        'For Approval',
        nextPosition
      ])

      const newTicket = ticketResult.rows[0]

      // Insert files if any
      if (files.length > 0) {
        const insertFilesQuery = `
          INSERT INTO ticket_files (ticket_id, file_name, uploaded_at) 
          VALUES ($1, $2, NOW() AT TIME ZONE 'Asia/Manila')
        `
        
        for (const fileName of files) {
          await client.query(insertFilesQuery, [newTicket.id, fileName])
        }
      }

      await client.query('COMMIT')

      // Return the created ticket in frontend format
      const createdTicket = {
        id: newTicket.ticket_id,
        name: newTicket.concern,
        date: newTicket.created_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || '',
        concern: newTicket.concern,
        category: newTicket.category,
        details: newTicket.details || '',
        email: user.email,
        files: files,
        status: newTicket.status,
        position: newTicket.position,
        createdAt: newTicket.created_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || '',
        updatedAt: newTicket.updated_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || ''
      }

      return NextResponse.json({
        success: true,
        ticket: createdTicket,
        message: 'Ticket created successfully'
      })

    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      )
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    if (pool) {
      await pool.end()
    }
  }
} 