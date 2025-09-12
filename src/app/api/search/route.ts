import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

interface SearchResult {
  id: string
  title: string
  description?: string
  type: 'ticket' | 'task' | 'break' | 'meeting' | 'health' | 'user' | 'page' | 'event'
  url: string
  metadata?: {
    status?: string
    priority?: string
    date?: string
    category?: string
  }
}

interface GlobalSearchResponse {
  success: boolean
  results: SearchResult[]
  query: string
  cached?: boolean
}

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

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ success: true, results: [], query: query || '' })
    }

    const searchQuery = query.trim()
    
    // Check Redis cache first
    const cacheKey = cacheKeys.globalSearch(user.id, searchQuery)
    const cachedData = await redisCache.get<GlobalSearchResponse>(cacheKey)
    
    if (cachedData) {
      return NextResponse.json({ ...cachedData, cached: true })
    }

    const searchTerm = `%${searchQuery}%`
    const results: SearchResult[] = []

    try {
      // Search tickets
      const ticketsQuery = `
        SELECT 
          t.ticket_id as id,
          t.concern as title,
          t.details as description,
          t.status,
          t.created_at,
          tc.name as category_name
        FROM tickets t
        LEFT JOIN ticket_categories tc ON t.category_id = tc.id
        WHERE t.user_id = $1 
        AND (
          t.concern ILIKE $2 
          OR t.details ILIKE $2 
          OR t.ticket_id ILIKE $2
          OR tc.name ILIKE $2
          OR t.status::text ILIKE $2
        )
        ORDER BY t.created_at DESC
        LIMIT 10
      `
      const ticketsResult = await executeQuery(ticketsQuery, [user.id, searchTerm])
      
      ticketsResult.forEach(row => {
        results.push({
          id: row.id,
          title: row.title,
          description: row.description,
          type: 'ticket',
          url: `/forms/${row.id}`,
          metadata: {
            status: row.status,
            category: row.category_name,
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined
          }
        })
      })

      // Search tasks
      const tasksQuery = `
        SELECT 
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.created_at,
          tg.title as group_title
        FROM tasks t
        LEFT JOIN task_groups tg ON t.group_id = tg.id
        WHERE (t.user_id = $1 OR EXISTS(
          SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1
        ))
        AND (
          t.title ILIKE $2 
          OR t.description ILIKE $2
          OR tg.title ILIKE $2
          OR t.status ILIKE $2
          OR t.priority ILIKE $2
        )
        AND t.status = 'active'
        ORDER BY t.created_at DESC
        LIMIT 10
      `
      const tasksResult = await executeQuery(tasksQuery, [user.id, searchTerm])
      
      tasksResult.forEach(row => {
        results.push({
          id: row.id.toString(),
          title: row.title,
          description: row.description,
          type: 'task',
          url: `/productivity/task-activity?taskId=${row.id}`,
          metadata: {
            status: row.status,
            priority: row.priority,
            category: row.group_title,
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined
          }
        })
      })

      // Search breaks
      const breaksQuery = `
        SELECT 
          bs.id,
          bs.break_type as title,
          bs.start_time,
          bs.end_time,
          bs.duration_minutes,
          bs.break_date
        FROM break_sessions bs
        WHERE bs.agent_user_id = $1
        AND (
          bs.break_type::text ILIKE $2
        )
        ORDER BY bs.start_time DESC
        LIMIT 5
      `
      const breaksResult = await executeQuery(breaksQuery, [user.id, searchTerm])
      
      breaksResult.forEach(row => {
        const isActive = !row.end_time
        results.push({
          id: row.id.toString(),
          title: `${row.title} Break`,
          description: isActive ? 'Currently active' : `Duration: ${row.duration_minutes} minutes`,
          type: 'break',
          url: '/status/breaks',
          metadata: {
            status: isActive ? 'active' : 'completed',
            date: row.break_date ? new Date(row.break_date).toLocaleDateString() : undefined
          }
        })
      })

      // Search meetings
      const meetingsQuery = `
        SELECT 
          m.id,
          m.title,
          m.description,
          m.status,
          m.meeting_type,
          m.start_time,
          m.end_time,
          m.created_at
        FROM meetings m
        WHERE m.agent_user_id = $1
        AND (
          m.title ILIKE $2 
          OR m.description ILIKE $2
          OR m.status ILIKE $2
          OR m.meeting_type ILIKE $2
        )
        ORDER BY m.start_time DESC
        LIMIT 5
      `
      const meetingsResult = await executeQuery(meetingsQuery, [user.id, searchTerm])
      
      meetingsResult.forEach(row => {
        const isActive = row.status === 'active'
        results.push({
          id: row.id.toString(),
          title: row.title,
          description: row.description,
          type: 'meeting',
          url: '/status/meetings',
          metadata: {
            status: row.status,
            date: row.start_time ? new Date(row.start_time).toLocaleDateString() : undefined
          }
        })
      })

      // Search events/activities
      const eventsQuery = `
        SELECT 
          e.id,
          e.title,
          e.description,
          e.status,
          e.event_type,
          e.event_date,
          e.start_time,
          e.end_time,
          e.location,
          e.created_at
        FROM events e
        WHERE (e.created_by = $1 OR $1 = ANY(e.assigned_user_ids))
        AND (
          e.title ILIKE $2 
          OR e.description ILIKE $2
          OR e.status ILIKE $2
          OR e.event_type ILIKE $2
          OR e.location ILIKE $2
        )
        ORDER BY e.event_date DESC, e.start_time DESC
        LIMIT 10
      `
      const eventsResult = await executeQuery(eventsQuery, [user.id, searchTerm])
      
      eventsResult.forEach(row => {
        const eventDate = row.event_date ? new Date(row.event_date).toLocaleDateString() : undefined
        const timeInfo = row.start_time && row.end_time 
          ? `${row.start_time} - ${row.end_time}`
          : row.start_time || row.end_time || ''
        
        results.push({
          id: row.id.toString(),
          title: row.title,
          description: row.description || (row.location ? `Location: ${row.location}` : ''),
          type: 'event',
          url: '/status/events',
          metadata: {
            status: row.status,
            date: eventDate,
            category: row.event_type
          }
        })
      })

      // Search health records (if user has access)
      const healthQuery = `
        SELECT 
          hcr.id,
          hcr.chief_complaint as title,
          hcr.diagnosis as description,
          hcr.visit_date,
          hcr.created_at
        FROM health_check_records hcr
        WHERE hcr.user_id = $1
        AND (
          hcr.chief_complaint ILIKE $2 
          OR hcr.diagnosis ILIKE $2
          OR hcr.treatment_plan ILIKE $2
        )
        ORDER BY hcr.created_at DESC
        LIMIT 5
      `
      const healthResult = await executeQuery(healthQuery, [user.id, searchTerm])
      
      healthResult.forEach(row => {
        results.push({
          id: row.id.toString(),
          title: row.title,
          description: row.description,
          type: 'health',
          url: '/health',
          metadata: {
            date: row.visit_date ? new Date(row.visit_date).toLocaleDateString() : undefined
          }
        })
      })

      // Search users (team members)
      const usersQuery = `
        SELECT 
          u.id,
          u.email,
          pi.first_name,
          pi.last_name,
          u.created_at
        FROM users u
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        WHERE (
          u.email ILIKE $2 
          OR pi.first_name ILIKE $2 
          OR pi.last_name ILIKE $2
        )
        AND u.id != $1
        ORDER BY u.created_at DESC
        LIMIT 5
      `
      const usersResult = await executeQuery(usersQuery, [user.id, searchTerm])
      
      usersResult.forEach(row => {
        const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim()
        results.push({
          id: row.id.toString(),
          title: fullName || row.email,
          description: row.email,
          type: 'user',
          url: `/settings/connected-users`,
          metadata: {
            date: row.created_at ? new Date(row.created_at).toLocaleDateString() : undefined
          }
        })
      })

             // Add static page results
       const staticPages = [
         { title: 'Dashboard', description: 'Main dashboard overview', url: '/dashboard', type: 'page' as const },
         { title: 'Activity', description: 'View activity analytics', url: '/dashboard/activity', type: 'page' as const },
         { title: 'Analytics', description: 'View detailed analytics', url: '/dashboard/analytics', type: 'page' as const },
         { title: 'New Ticket', description: 'Create a new support ticket', url: '/forms/new', type: 'page' as const },
         { title: 'My Tickets', description: 'View your tickets', url: '/forms/my-tickets', type: 'page' as const },
         { title: 'Task Management', description: 'Manage tasks and activities', url: '/productivity/task-activity', type: 'page' as const },
         { title: 'Break Management', description: 'Manage breaks and time off', url: '/status/breaks', type: 'page' as const },
         { title: 'Meeting Management', description: 'Manage meetings', url: '/status/meetings', type: 'page' as const },
         { title: 'Events & Activities', description: 'Manage events and activities', url: '/status/events', type: 'page' as const },
         { title: 'Restroom Status', description: 'Manage restroom status', url: '/status/restroom', type: 'page' as const },
         { title: 'Health Records', description: 'View health records', url: '/status/health', type: 'page' as const },
         { title: 'Profile', description: 'User profile settings', url: '/settings/profile', type: 'page' as const },
         { title: 'FAQ', description: 'Frequently asked questions', url: '/help/faq', type: 'page' as const },
         { title: 'Contact Support', description: 'Contact support team', url: '/help/contact', type: 'page' as const },
         { title: 'Notifications', description: 'View all notifications', url: '/notifications', type: 'page' as const }
       ]

      staticPages.forEach(page => {
        if (page.title.toLowerCase().includes(query.toLowerCase()) || 
            page.description.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: page.url,
            title: page.title,
            description: page.description,
            type: page.type,
            url: page.url
          })
        }
      })

      // Sort results by relevance (exact matches first, then partial matches)
      results.sort((a, b) => {
        const aTitle = a.title.toLowerCase()
        const bTitle = b.title.toLowerCase()
        const queryLower = query.toLowerCase()
        
        const aExact = aTitle === queryLower
        const bExact = bTitle === queryLower
        
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        const aStarts = aTitle.startsWith(queryLower)
        const bStarts = bTitle.startsWith(queryLower)
        
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1
        
        return 0
      })

      const responseData: GlobalSearchResponse = {
        success: true,
        results: results.slice(0, 20),
        query: searchQuery
      }

      // Cache the result in Redis
      await redisCache.set(cacheKey, responseData, cacheTTL.globalSearch)

      return NextResponse.json(responseData)

    } catch (error) {
      console.error('Search error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
