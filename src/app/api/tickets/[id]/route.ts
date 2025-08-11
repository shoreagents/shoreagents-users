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
      id: authData.user.railway_id || authData.user.id,
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
  // Optional SSE stream for a single ticket
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

      const ticketId = (await params).id
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
              const affectedTicketId = (record?.ticket_id ?? oldRecord?.ticket_id) as string | undefined
              const affectedUserId = (record?.user_id ?? oldRecord?.user_id) as number | undefined
              // Only emit if this event is for the requested ticket and belongs to this user (or user is admin)
              const currentUserIdNum = Number((user as any).id)
              if (affectedTicketId === ticketId && (user.role === 'admin' || (Number.isFinite(currentUserIdNum) && affectedUserId === currentUserIdNum))) {
                send(payload)
              }
            } catch {}
          }

          await client.query('LISTEN ticket_changes')
          client.on('notification', onNotification)

          send({ type: 'connected', channel: 'ticket_changes', scope: 'ticket', ticketId })

          const interval = setInterval(heartbeat, 25000)
          const abortHandler = () => onClose()
          request.signal.addEventListener('abort', abortHandler)

          ;(stream as any).cancel = onClose

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
    console.error('❌ SSE setup error (ticket):', e)
    return NextResponse.json({ error: 'Failed to establish stream' }, { status: 500 })
  }

  let pool: Pool | null = null
  
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    console.log('🔍 GET - User from request:', user)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    const ticketId = (await params).id
    console.log('🔍 GET - Ticket ID:', ticketId)

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
          resolver.email as resolved_by_email,
          tc.name as category_name
        FROM tickets t
        LEFT JOIN users u ON t.user_id = u.id
        LEFT JOIN users resolver ON t.resolved_by = resolver.id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        WHERE t.ticket_id = $1
      `

      const result = await client.query(ticketQuery, [ticketId])

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      const row = result.rows[0]
      console.log('🔍 GET - Ticket user_email:', row.user_email)
      console.log('🔍 GET - Request user.email:', user.email)

      // Check if the current user is the ticket owner or has admin access
      // Compare by email since user.id might be in different format
      if (row.user_email !== user.email && user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized - You can only view your own tickets' },
          { status: 403 }
        )
      }

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
      }

      return NextResponse.json({
        success: true,
        ticket
      })

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
      client.release()
    }

  } catch (error) {
    console.error('❌ Error in ticket API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
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

// PATCH: Update a specific ticket (e.g., for file uploads)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let pool: Pool | null = null
  
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    console.log('🔍 PATCH - User from request:', user)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    const ticketId = (await params).id
    console.log('🔍 PATCH - Ticket ID:', ticketId)

    // Parse request body
    const body = await request.json()
    const { supporting_files, file_count } = body
    
    console.log('🔍 PATCH request body:', body)
    console.log('🔍 supporting_files:', supporting_files)
    console.log('🔍 file_count:', file_count)

    // Create database connection
    pool = new Pool(databaseConfig)
    const client = await pool.connect()

    try {
      // Check if ticket exists and user has permission
      const ticketQuery = `
        SELECT t.id, t.user_id, u.email as user_email 
        FROM tickets t 
        LEFT JOIN users u ON t.user_id = u.id 
        WHERE t.ticket_id = $1
      `
      const ticketResult = await client.query(ticketQuery, [ticketId])

      if (ticketResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      const ticket = ticketResult.rows[0]
      console.log('🔍 Ticket user_id:', ticket.user_id, 'Ticket user_email:', ticket.user_email)
      console.log('🔍 Request user.id:', user.id, 'Request user.email:', user.email)

      // Check if the current user is the ticket owner or has admin access
      // Compare by email since user.id might be in different format
      if (ticket.user_email !== user.email && user.role !== 'admin') {
        return NextResponse.json(
          { error: 'Unauthorized - You can only update your own tickets' },
          { status: 403 }
        )
      }

      // Update the ticket with new file information
      const updateQuery = `
        UPDATE tickets 
        SET supporting_files = $1, file_count = $2, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
        WHERE ticket_id = $3
        RETURNING id, ticket_id, supporting_files, file_count
      `

      console.log('🔍 Update query parameters:', [supporting_files || [], file_count || 0, ticketId])

      // Ensure file_count matches the actual array length
      const actualFileCount = Array.isArray(supporting_files) ? supporting_files.length : 0
      const filesArray = Array.isArray(supporting_files) ? supporting_files : []
      
      console.log('🔍 Actual file count:', actualFileCount)
      console.log('🔍 Files array:', filesArray)
      
      const updateResult = await client.query(updateQuery, [
        filesArray,
        actualFileCount,
        ticketId
      ])

      console.log('🔍 Update result:', updateResult.rows[0])

      if (updateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Failed to update ticket' },
          { status: 500 }
        )
      }

      const updatedTicket = updateResult.rows[0]

      return NextResponse.json({
        success: true,
        ticket: {
          id: updatedTicket.ticket_id,
          supportingFiles: updatedTicket.supporting_files,
          fileCount: updatedTicket.file_count
        }
      })

    } catch (error) {
      console.error('❌ Error updating ticket:', error)
      return NextResponse.json(
        { 
          error: 'Failed to update ticket',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      )
    } finally {
      client.release()
    }

  } catch (error) {
    console.error('❌ Error in ticket PATCH API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
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