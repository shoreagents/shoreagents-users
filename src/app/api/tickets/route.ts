import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// Database configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
  // Get user from cookies (same pattern as other APIs)
  const authCookie = request.cookies.get('shoreagents-auth')
  
  if (!authCookie) {
    return null
  }

  try {
    const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
    const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
    const authData = JSON.parse(decoded)
    if (!authData.isAuthenticated || !authData.user) {
      return null
    }

    // Return the user data from the cookie
    return {
      id: authData.user.railway_id || authData.user.id, // Use railway_id for database operations
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
  // If client requests SSE stream, switch to LISTEN on PostgreSQL channel
  try {
    const url = new URL(request.url)
    const wantsSSE =
      request.headers.get('accept')?.includes('text/event-stream') === true ||
      url.searchParams.get('stream') === '1'

    if (wantsSSE) {
      const user = getUserFromRequest(request)
      if (!user) {
        return new NextResponse('Unauthorized', { status: 401 })
      }

      const pool = new Pool(databaseConfig)
      const client = await pool.connect()

      const encoder = new TextEncoder()
      let closed = false

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (data: any) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }

          const heartbeat = () => {
            controller.enqueue(encoder.encode(`: ping\n\n`))
          }

          const onClose = async () => {
            if (closed) return
            closed = true
            try { await client.query('UNLISTEN ticket_changes') } catch {}
            client.removeListener('notification', onNotification)
            client.release()
            await pool.end().catch(() => {})
            controller.close()
          }

          const onNotification = (msg: any) => {
            try {
              const payload = JSON.parse(msg.payload || '{}')
              const record = payload.record || null
              const oldRecord = payload.old_record || null
              const affectedUserId = (record?.user_id ?? oldRecord?.user_id) as number | undefined
              // Only emit events for this user (or if they are admin)
              const currentUserIdNum = Number((user as any).id)
              if (user.role === 'admin' || (Number.isFinite(currentUserIdNum) && affectedUserId === currentUserIdNum)) {
                send(payload)
              }
            } catch (_e) {
              // Ignore malformed payloads
            }
          }

          // Begin listening
          await client.query('LISTEN ticket_changes')
          client.on('notification', onNotification)

          // Initial event to confirm connection
          send({ type: 'connected', channel: 'ticket_changes' })

          // Heartbeat to keep the connection alive (every 25s)
          const interval = setInterval(heartbeat, 25000)

          // Close handling
          const abortHandler = () => onClose()
          request.signal.addEventListener('abort', abortHandler)

          // When the stream is canceled by the client
          ;(stream as any).cancel = onClose

          // Ensure interval cleared on close
          const originalClose = controller.close.bind(controller)
          controller.close = () => {
            clearInterval(interval)
            originalClose()
          }
        },
      })

      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }
  } catch (e) {
    console.error('❌ SSE setup error:', e)
    return NextResponse.json({ error: 'Failed to establish stream' }, { status: 500 })
  }

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
      // Get tickets for the user by user_id (using railway_id)
      const ticketsQuery = `
        SELECT 
          t.id,
          t.ticket_id,
          t.user_id,
          t.concern,
          t.details,
          t.category_id,
          t.status,
          t.resolved_by,
          t.resolved_at,
          t.created_at,
          t.updated_at,
          t.position,
          t.supporting_files,
          t.file_count,
          t.role_id,
          u.email as user_email,
          TRIM(CONCAT(COALESCE(pi_resolver.first_name, ''), ' ', COALESCE(pi_resolver.last_name, ''))) as resolved_by_name,
          resolver.email as resolved_by_email,
          tc.name as category_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users resolver ON t.resolved_by = resolver.id
        LEFT JOIN personal_info pi_resolver ON resolver.id = pi_resolver.user_id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        WHERE t.user_id = $1
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
        category: row.category_name || 'Uncategorized',
        details: row.details || '',
        email: row.user_email,
        files: row.supporting_files || [],
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
        resolvedByName: row.resolved_by_name,
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
        position: row.position,
        categoryId: row.category_id,
        roleId: row.role_id,
        supportingFiles: row.supporting_files || [],
        fileCount: row.file_count || 0
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
      // Ensure this connection/session uses Philippine Standard Time for NOW()/CURRENT_TIMESTAMP
      await client.query("SET TIME ZONE 'Asia/Manila'")
      await client.query('BEGIN')

      // Check if user exists in database, if not create them
      let userId = user.id
      const userCheckQuery = 'SELECT id FROM users WHERE email = $1'
      const userResult = await client.query(userCheckQuery, [user.email])
      
      if (userResult.rows.length === 0) {
        // Create user if they don't exist
        const createUserQuery = `
          INSERT INTO users (email, name, user_type, created_at, updated_at)
          VALUES ($1, $2, $3, NOW(), NOW())
          RETURNING id
        `
        const newUserResult = await client.query(createUserQuery, [
          user.email,
          user.name || 'Unknown User',
          user.user_type || 'agent'
        ])
        userId = newUserResult.rows[0].id
      } else {
        userId = userResult.rows[0].id
      }

      // Handle category - create if doesn't exist
      let categoryId = null
      if (category) {
        const categoryQuery = 'SELECT id FROM ticket_categories WHERE name = $1'
        const categoryResult = await client.query(categoryQuery, [category])
        
        if (categoryResult.rows.length === 0) {
          // Create new category
          const createCategoryQuery = `
            INSERT INTO ticket_categories (name, created_at, updated_at)
            VALUES ($1, NOW(), NOW())
            RETURNING id
          `
          const newCategoryResult = await client.query(createCategoryQuery, [category])
          categoryId = newCategoryResult.rows[0].id
        } else {
          categoryId = categoryResult.rows[0].id
        }
      }

      // Get the next position value
      const positionResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM tickets'
      )
      const nextPosition = positionResult.rows[0].next_position

      // Insert the ticket (ticket_id will be auto-generated by trigger)
      const insertTicketQuery = `
        INSERT INTO tickets (
          user_id, concern, details, category_id, position, 
          supporting_files, file_count, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, ticket_id, concern, details, status, position, supporting_files, file_count, created_at
      `

      const ticketResult = await client.query(insertTicketQuery, [
        userId,
        concern,
        details || '',
        categoryId,
        nextPosition,
        files,
        files.length
      ])

      const newTicket = ticketResult.rows[0]

      await client.query('COMMIT')

      // Return the created ticket
      return NextResponse.json({
        success: true,
        ticket: {
          id: newTicket.ticket_id,
          name: newTicket.concern,
          concern: newTicket.concern,
          details: newTicket.details,
          category: category,
          status: newTicket.status,
          position: newTicket.position,
          files: newTicket.supporting_files || [],
          fileCount: newTicket.file_count,
          createdAt: newTicket.created_at?.toLocaleString('en-US', { 
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) || '',
          userId: userId,
          userEmail: user.email,
          categoryId: categoryId
        }
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