import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'
import { getOptimizedClient } from '@/lib/database-optimized'
import { slackService } from '@/lib/slack-service'

// Database configuration for SSE (Server-Sent Events) - needs persistent connections
const sseDatabaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Limit concurrent connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds (increased from 2s)
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000, // 30 second query timeout
}

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
  // Get user from cookies
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
  { params }: { params: Promise<{ id: string }> }
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
      const encoder = new TextEncoder()
      let closed = false
      let pool: Pool | null = null
      let client: any = null

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Create database connection
            pool = new Pool(sseDatabaseConfig)
            client = await pool.connect()
          } catch (error) {
            console.error('Failed to connect to database:', error instanceof Error ? error.message : String(error))
            controller.close()
            return
          }

          const send = (data: any) => {
            if (!closed) {
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
              } catch (error) {
                if (!closed) {
                  console.error('Error sending SSE data:', error instanceof Error ? error.message : String(error))
                  onClose()
                }
              }
            }
          }

          const heartbeat = () => {
            if (!closed) {
              try {
                controller.enqueue(encoder.encode(`: ping\n\n`))
              } catch (error) {
                if (!closed) {
                  console.error('Error sending heartbeat:', error instanceof Error ? error.message : String(error));
                  onClose()
                }
              }
            }
          }

          const onClose = async () => {
            if (closed) return
            closed = true
            try { 
              if (client) {
                await client.query('UNLISTEN ticket_changes') 
                await client.query('UNLISTEN ticket_comments')
                client.removeListener('notification', onNotification)
                client.release()
              }
            } catch {}
            try { 
              if (pool) {
                await pool.end()
              }
            } catch {}
            try { controller.close() } catch {}
          }

          const onNotification = (msg: any) => {
            try {
              const payload = JSON.parse(msg.payload || '{}')
              
              if (msg.channel === 'ticket_changes') {
                const record = payload.record || null
                const oldRecord = payload.old_record || null
                const affectedTicketId = (record?.ticket_id ?? oldRecord?.ticket_id) as string | undefined
                const affectedUserId = (record?.user_id ?? oldRecord?.user_id) as number | undefined
                // Only emit if this event is for the requested ticket and belongs to this user (or user is admin)
                const currentUserIdNum = Number((user as any).id)
                if (affectedTicketId === ticketId && (user.role === 'admin' || (Number.isFinite(currentUserIdNum) && affectedUserId === currentUserIdNum))) {
                  send(payload)
                }
              } else if (msg.channel === 'ticket_comments') {
                // Handle comment changes - check if this comment is for the current ticket
                const commentTicketRowId = payload.ticket_row_id
                if (commentTicketRowId) {
                  // Get the ticket_id for this ticket_row_id to match with the requested ticketId
                  client.query('SELECT ticket_id FROM tickets WHERE id = $1', [commentTicketRowId])
                    .then((result: any) => {
                      if (result.rows.length > 0 && result.rows[0].ticket_id === ticketId) {
                        // This comment is for the current ticket, send it
                        send({ ...payload, channel: 'ticket_comments' })
                      } 
                    })
                    .catch((error: any) => {
                      console.error('Error checking ticket_id:', error)
                    })
                } else {
                  console.log('No ticket_row_id in comment payload')
                }
              }
            } catch {}
          }

          if (client) {
            await client.query('LISTEN ticket_changes')
            await client.query('LISTEN ticket_comments')
            client.on('notification', onNotification)
          }

          send({ type: 'connected', channel: 'ticket_changes', scope: 'ticket', ticketId })
          send({ type: 'connected', channel: 'ticket_comments', scope: 'ticket', ticketId })

          const interval = setInterval(heartbeat, 25000)
          const abortHandler = () => onClose()
          request.signal.addEventListener('abort', abortHandler)

          ;(stream as any).cancel = onClose

          const originalClose = controller.close.bind(controller)
          controller.close = () => {
            clearInterval(interval)
            try {
              originalClose()
            } catch (err) {
              // Ignore double-close errors to prevent uncaught exceptions
            }
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
    console.error('SSE setup error (ticket):', e)
    return NextResponse.json({ error: 'Failed to establish stream' }, { status: 500 })
  }

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

    // Check if this is a real-time update request (bypass cache)
    const url = new URL(request.url)
    const bypassCache = url.searchParams.get('bypass_cache') === 'true'
    
    // Check Redis cache first (unless bypassing)
    const cacheKey = cacheKeys.ticket(ticketId)
    let cachedData = null
    
    if (!bypassCache) {
      cachedData = await redisCache.get(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData)
      }
    } 

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
        TRIM(CONCAT(COALESCE(pi_resolver.first_name, ''), ' ', COALESCE(pi_resolver.last_name, ''))) as resolved_by_name,
        resolver.email as resolved_by_email,
        tc.name as category_name
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users resolver ON t.resolved_by = resolver.id
      LEFT JOIN personal_info pi_resolver ON resolver.id = pi_resolver.user_id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.id
      WHERE t.ticket_id = $1
    `

    const result = await executeQuery(ticketQuery, [ticketId])

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    const row = result[0]
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
    }

    const responseData = {
      success: true,
      ticket
    }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.ticket)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error in ticket API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PUT: Update a specific ticket (e.g., status, details, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Parse request body
    const body = await request.json()
    const { status, concern, details, category, resolved_by } = body
    

    // Use shared database connection for transaction
    const client = await getDatabaseClient()

    try {
      await client.query('BEGIN')

      // Check if ticket exists and user has permission
      const ticketQuery = `
        SELECT t.id, t.user_id, u.email as user_email, t.status as current_status
        FROM tickets t 
        LEFT JOIN users u ON t.user_id = u.id 
        WHERE t.ticket_id = $1
      `
      const ticketResult = await client.query(ticketQuery, [ticketId])

      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      const ticket = ticketResult.rows[0]
      // Check if the current user is the ticket owner or has admin access
      // Compare by email since user.id might be in different format
      if (ticket.user_email !== user.email && user.role !== 'admin') {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Unauthorized - You can only update your own tickets' },
          { status: 403 }
        )
      }

      // Build dynamic update query based on provided fields
      const updateFields = []
      const updateValues = []
      let paramCount = 1

      if (status !== undefined) {
        updateFields.push(`status = $${paramCount}`)
        updateValues.push(status)
        paramCount++
      }

      if (concern !== undefined) {
        updateFields.push(`concern = $${paramCount}`)
        updateValues.push(concern)
        paramCount++
      }

      if (details !== undefined) {
        updateFields.push(`details = $${paramCount}`)
        updateValues.push(details)
        paramCount++
      }

      if (resolved_by !== undefined) {
        updateFields.push(`resolved_by = $${paramCount}`)
        updateValues.push(resolved_by)
        paramCount++
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Manila'`)

      if (updateFields.length === 1) { // Only updated_at
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        )
      }

      // Add ticket_id as the last parameter
      updateValues.push(ticketId)

      const updateQuery = `
        UPDATE tickets 
        SET ${updateFields.join(', ')}
        WHERE ticket_id = $${paramCount}
        RETURNING id, ticket_id, concern, details, status, resolved_by, updated_at
      `
      const updateResult = await client.query(updateQuery, updateValues)

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json(
          { error: 'Failed to update ticket' },
          { status: 500 }
        )
      }

      await client.query('COMMIT')

      const updatedTicket = updateResult.rows[0]

      // Invalidate Redis cache for this user's tickets and individual ticket
      const userTicketsCacheKey = cacheKeys.tickets(ticket.user_email)
      const individualTicketCacheKey = cacheKeys.ticket(ticketId)
      await redisCache.del(userTicketsCacheKey)
      await redisCache.del(individualTicketCacheKey)

      // Send Slack notification for status update if status changed
      if (status !== undefined && status !== ticket.current_status) {
        try {
          // Get full ticket details for Slack notification
          const fullTicketQuery = `
            SELECT t.id, t.ticket_id, t.concern, t.details, t.status, t.created_at,
                   t.supporting_files, t.file_count,
                   u.email as user_email,
                   tc.name as category_name,
                   COALESCE(pi.first_name || ' ' || pi.last_name, u.email) as user_name
            FROM tickets t 
            LEFT JOIN users u ON t.user_id = u.id 
            LEFT JOIN ticket_categories tc ON t.category_id = tc.id
            LEFT JOIN personal_info pi ON u.id = pi.user_id
            WHERE t.ticket_id = $1
          `
          const fullTicketResult = await client.query(fullTicketQuery, [ticketId])
          
          if (fullTicketResult.rows.length > 0) {
            const fullTicket = fullTicketResult.rows[0]
            
            // Parse supporting_files if it's a JSON string
            let supportingFiles = []
            if (fullTicket.supporting_files) {
              try {
                supportingFiles = typeof fullTicket.supporting_files === 'string' 
                  ? JSON.parse(fullTicket.supporting_files) 
                  : fullTicket.supporting_files
              } catch (error) {
                console.error('Error parsing supporting_files:', error)
                supportingFiles = []
              }
            }
            
            const slackTicketData = {
              id: fullTicket.id.toString(),
              ticket_id: fullTicket.ticket_id,
              concern: fullTicket.concern,
              details: fullTicket.details,
              category: fullTicket.category_name || 'Unknown',
              status: fullTicket.status,
              created_at: fullTicket.created_at,
              user_name: fullTicket.user_name || 'Unknown User', // Use name from personal_info table
              user_email: fullTicket.user_email,
              supporting_files: supportingFiles,
              file_count: fullTicket.file_count || 0
            }
            
            // Send notification asynchronously (don't wait for it)
            slackService.sendTicketStatusUpdate(slackTicketData, ticket.current_status).catch(error => {
              console.error('Failed to send Slack status update notification:', error)
            })
          }
        } catch (error) {
          console.error('Error preparing Slack status update notification:', error)
          // Don't fail the ticket update if Slack fails
        }
      }

      return NextResponse.json({
        success: true,
        ticket: {
          id: updatedTicket.ticket_id,
          concern: updatedTicket.concern,
          details: updatedTicket.details,
          status: updatedTicket.status,
          resolvedBy: updatedTicket.resolved_by,
          updatedAt: updatedTicket.updated_at?.toLocaleString('en-US', { 
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }) || ''
        }
      })

    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Error updating ticket:', error)
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
    console.error('Error in ticket PUT API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH: Update a specific ticket (e.g., for file uploads)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Parse request body
    const body = await request.json()
    const { supporting_files, file_count } = body
    
    // Use optimized database connection
    try {
      const client = await getOptimizedClient()
      
      try {
      // Check if ticket exists and user has permission
      const ticketQuery = `
        SELECT t.id, t.user_id, u.email as user_email, t.file_count as previous_file_count
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
      // Ensure file_count matches the actual array length
      const actualFileCount = Array.isArray(supporting_files) ? supporting_files.length : 0
      const filesArray = Array.isArray(supporting_files) ? supporting_files : []
      
      const updateResult = await client.query(updateQuery, [
        filesArray,
        actualFileCount,
        ticketId
      ])

      if (updateResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Failed to update ticket' },
          { status: 500 }
        )
      }

      const updatedTicket = updateResult.rows[0]

      // Invalidate Redis cache for this user's tickets and individual ticket
      const userTicketsCacheKey = cacheKeys.tickets(ticket.user_email)
      const individualTicketCacheKey = cacheKeys.ticket(ticketId)
      await redisCache.del(userTicketsCacheKey)
      await redisCache.del(individualTicketCacheKey)

      // Send Slack notification for all tickets
      // This handles both tickets with and without attachments
      
      try {
        // Get full ticket details for Slack notification
        const fullTicketQuery = `
          SELECT t.id, t.ticket_id, t.concern, t.details, t.status, t.created_at,
                 t.supporting_files, t.file_count,
                 u.email as user_email,
                 tc.name as category_name,
                 COALESCE(pi.first_name || ' ' || pi.last_name, u.email) as user_name
          FROM tickets t 
          LEFT JOIN users u ON t.user_id = u.id 
          LEFT JOIN ticket_categories tc ON t.category_id = tc.id
          LEFT JOIN personal_info pi ON u.id = pi.user_id
          WHERE t.ticket_id = $1
        `
        const fullTicketResult = await client.query(fullTicketQuery, [ticketId])
        
        if (fullTicketResult.rows.length > 0) {
          const fullTicket = fullTicketResult.rows[0]
          
          // Parse supporting_files if it's a JSON string
          let supportingFiles = []
          if (fullTicket.supporting_files) {
            try {
              supportingFiles = typeof fullTicket.supporting_files === 'string' 
                ? JSON.parse(fullTicket.supporting_files) 
                : fullTicket.supporting_files
            } catch (error) {
              console.error('Error parsing supporting_files:', error)
              supportingFiles = []
            }
          }
          
          const slackTicketData = {
            id: fullTicket.id.toString(),
            ticket_id: fullTicket.ticket_id,
            concern: fullTicket.concern,
            details: fullTicket.details,
            category: fullTicket.category_name || 'Unknown',
            status: fullTicket.status,
            created_at: fullTicket.created_at,
            user_name: fullTicket.user_name || 'Unknown User',
            user_email: fullTicket.user_email,
            supporting_files: supportingFiles,
            file_count: fullTicket.file_count || 0
          }
          
          // Send notification - use new ticket notification if this is the first notification
          // Use updated ticket notification if ticket was already notified
          const previousFileCount = ticket.previous_file_count || 0
          if (previousFileCount === 0) {
            // This is the first notification for this ticket
            slackService.sendNewTicketNotification(slackTicketData).catch(error => {
              console.error('Failed to send Slack notification:', error)
            })
          } else {
            // This is an update to an existing ticket
            slackService.sendUpdatedTicketNotification(slackTicketData).catch(error => {
              console.error('Failed to send updated Slack notification:', error)
            })
          }
        }
      } catch (error) {
        console.error('Error preparing Slack notification:', error)
      }

      return NextResponse.json({
        success: true,
        ticket: {
          id: updatedTicket.ticket_id,
          supportingFiles: updatedTicket.supporting_files,
          fileCount: updatedTicket.file_count
        }
      })

    } catch (error) {
      console.error('Error updating ticket:', error)
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
    } catch (dbError) {
      console.error('Database connection error in ticket PATCH API:', dbError)
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          details: dbError instanceof Error ? dbError.message : 'Connection timeout or database unavailable'
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('Error in ticket PATCH API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 