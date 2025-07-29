import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
  // Get user from cookies
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

// GET: Retrieve a specific ticket by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const ticketId = (await params).id

    // Create database connection
    pool = new Pool(databaseConfig)
    const client = await pool.connect()

    try {
      // Get specific ticket for the user
      const ticketQuery = `
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
        WHERE t.ticket_id = $1 AND t.user_id = $2
        GROUP BY t.id, u.email, resolver.email
      `

      const result = await client.query(ticketQuery, [ticketId, user.id])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      const row = result.rows[0]

      // Transform database result to match frontend interface
      const ticket = {
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
        }) || null
      }

      return NextResponse.json({
        success: true,
        ticket
      })

    } finally {
      client.release()
    }

  } catch (error) {
    console.error('❌ Error fetching ticket:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch ticket',
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