import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'



// Helper function to get user from request (same pattern as tickets API)
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
    const currentUser = getUserFromRequest(request)
    
    if (!currentUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = currentUser.id

    // Check Redis cache first
    const cacheKey = cacheKeys.taskStats()
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get task statistics by group
    const groupStatsQuery = `
      SELECT 
        tg.id,
        tg.title as group_title,
        tg.color as group_color,
        tg.position,
        COUNT(t.id) as task_count,
        COUNT(CASE WHEN t.priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN t.priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN t.priority = 'normal' THEN 1 END) as normal_count,
        COUNT(CASE WHEN t.priority = 'low' THEN 1 END) as low_count
      FROM task_groups tg
      LEFT JOIN tasks t ON tg.id = t.group_id AND t.status = 'active'
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
      GROUP BY tg.id, tg.title, tg.color, tg.position
      ORDER BY tg.position
    `

    // Get priority distribution
    const priorityStatsQuery = `
      SELECT 
        priority,
        COUNT(*) as count
      FROM tasks t
      WHERE t.status = 'active'
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
      GROUP BY priority
      ORDER BY 
        CASE priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END
    `

    // Get overdue tasks count
    const overdueStatsQuery = `
      SELECT 
        COUNT(*) as overdue_count,
        COUNT(CASE WHEN t.due_date <= (NOW() AT TIME ZONE 'Asia/Manila') - INTERVAL '1 day' THEN 1 END) as very_overdue_count
      FROM tasks t
      WHERE t.status = 'active'
        AND t.due_date IS NOT NULL
        AND t.due_date < (NOW() AT TIME ZONE 'Asia/Manila')
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
    `

    // Get recent activity (tasks created/updated in last 7 days)
    const recentActivityQuery = `
      SELECT 
        DATE(t.created_at AT TIME ZONE 'Asia/Manila') as date,
        COUNT(*) as created_count
      FROM tasks t
      WHERE t.status = 'active'
        AND t.created_at >= (NOW() AT TIME ZONE 'Asia/Manila') - INTERVAL '7 days'
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
      GROUP BY DATE(t.created_at AT TIME ZONE 'Asia/Manila')
      ORDER BY date
    `

    try {
      const results = await Promise.all([
        executeQuery(groupStatsQuery, [userId]),
        executeQuery(priorityStatsQuery, [userId]),
        executeQuery(overdueStatsQuery, [userId]),
        executeQuery(recentActivityQuery, [userId])
      ])
      
      const groupStats = results[0]
      const priorityStats = results[1]
      const overdueStats = results[2]
      const recentActivity = results[3]

      // Build 7-day series for recent activity
      const days: string[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push(d.toLocaleDateString('en-CA'))
      }

      const activitySeries = days.map(date => {
        const dayData = recentActivity.find((row: any) => 
          new Date(row.date).toLocaleDateString('en-CA') === date
        )
        return {
          date,
          count: dayData?.created_count || 0
        }
      })

      const responseData = {
        success: true,
        statistics: {
          groups: groupStats,
          priorities: priorityStats,
          overdue: overdueStats[0] || { overdue_count: 0, very_overdue_count: 0 },
          recentActivity: activitySeries,
          totalTasks: groupStats.reduce((sum: number, group: any) => sum + parseInt(group.task_count), 0)
        }
      }

      // Cache the result in Redis
      await redisCache.set(cacheKey, responseData, cacheTTL.taskStats)
      return NextResponse.json(responseData)
    } catch (dbError) {
      console.error('Task stats API - Database error:', dbError)
      return NextResponse.json({ 
        error: 'Database error', 
        details: dbError instanceof Error ? dbError.message : 'Unknown error' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error fetching task statistics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
