import { NextRequest, NextResponse } from 'next/server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';
import { executeQuery } from '@/lib/database-server';

// Ensure Node.js runtime for pg
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekStart = searchParams.get('weekStart') || getCurrentWeekStart();
    const limit = parseInt(searchParams.get('limit') || '10');

    // Check Redis cache first
    const cacheKey = `leaderboard:weekly:summary:${weekStart}:${limit}`
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Calculate week end date (6 days after week start)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Get weekly leaderboard data using weekly_activity_summary table
    const weeklyLeaderboardQuery = `
      SELECT 
        u.id as user_id,
        u.email,
        pi.first_name,
        pi.last_name,
        pi.profile_picture,
        COALESCE(was.total_active_seconds, 0) as weekly_active_seconds,
        COALESCE(was.total_inactive_seconds, 0) as weekly_inactive_seconds,
        -- Calculate weekly points: active points - inactive points (1 hour = 1 point)
        GREATEST(0, ROUND((COALESCE(was.total_active_seconds, 0) - COALESCE(was.total_inactive_seconds, 0)) / 3600.0, 1)) as weekly_points,
        -- Check if user is currently active (from activity_data)
        COALESCE(ad.is_currently_active, false) as is_currently_active,
        -- Check if user is on break (from break_sessions)
        CASE WHEN bs.id IS NOT NULL AND bs.end_time IS NULL THEN true ELSE false END as is_in_break
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      LEFT JOIN weekly_activity_summary was ON u.id = was.user_id 
        AND was.week_start_date = $1::date
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      LEFT JOIN break_sessions bs ON u.id = bs.agent_user_id AND bs.end_time IS NULL
      WHERE u.user_type = 'Agent'
      ORDER BY weekly_points DESC, u.id
      LIMIT $2
    `;

    const leaderboardResult = await executeQuery(weeklyLeaderboardQuery, [weekStart, limit]);
    
    // Transform the data to match the expected format
    const leaderboard = (leaderboardResult as any[]).map((row: any, index: number) => ({
      rank: index + 1,
      userId: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown User',
      profilePicture: row.profile_picture || '',
      productivityScore: parseFloat(row.weekly_points || 0), // Use weekly_points as productivity score
      totalActiveTime: parseInt(row.weekly_active_seconds || 0),
      totalInactiveTime: parseInt(row.weekly_inactive_seconds || 0),
      isCurrentlyActive: row.is_currently_active || false,
      isInBreak: row.is_in_break || false
    }));

    // Get current user's rank if authenticated
    let currentUserRank = 0;
    
    // Try to get user email from cookies first, then from Authorization header
    let userEmail: string | null = null;
    
    // Try cookie first
    try {
      const authCookie = request.cookies.get('shoreagents-auth')?.value;
      if (authCookie) {
        let authData: any = null;
        try {
          authData = JSON.parse(decodeURIComponent(authCookie));
        } catch {
          try { authData = JSON.parse(authCookie); } catch { authData = null; }
        }
        userEmail = authData?.user?.email || null;
      }
    } catch (e) {
      // ignore cookie parsing errors
    }
    
    // Fallback to Authorization header
    if (!userEmail) {
      try {
        const authHeader = request.headers.get('authorization');
        if (authHeader) {
          const authData = JSON.parse(authHeader.replace('Bearer ', ''));
          userEmail = authData?.user?.email || null;
        }
      } catch (error) {
        console.error('Error parsing auth header:', error);
      }
    }
    
    if (userEmail) {
      try {
        const userRankQuery = `
          WITH ranked_users AS (
            SELECT 
              u.id,
              u.email,
              GREATEST(0, ROUND((COALESCE(was.total_active_seconds, 0) - COALESCE(was.total_inactive_seconds, 0)) / 3600.0, 1)) as weekly_points,
              ROW_NUMBER() OVER (ORDER BY GREATEST(0, ROUND((COALESCE(was.total_active_seconds, 0) - COALESCE(was.total_inactive_seconds, 0)) / 3600.0, 1)) DESC, u.id) as rank
            FROM users u
            INNER JOIN agents a ON u.id = a.user_id
            LEFT JOIN weekly_activity_summary was ON u.id = was.user_id 
              AND was.week_start_date = $1::date
            WHERE u.user_type = 'Agent'
          )
          SELECT rank FROM ranked_users WHERE email = $2
        `;
        
        const rankResult = await executeQuery(userRankQuery, [weekStart, userEmail]);
        if (rankResult.length > 0) {
          currentUserRank = rankResult[0].rank;
        }
      } catch (error) {
        console.error('Error getting user rank:', error);
      }
    }

    const responseData = {
      success: true,
      leaderboard,
      currentUserRank,
      weekStart,
      weekEnd: weekEndStr,
      type: 'weekly'
    }

    // Cache the result in Redis (shorter cache for weekly data)
    await redisCache.set(cacheKey, responseData, 10 * 60) // 10 minutes cache

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Weekly Leaderboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly leaderboard data' },
      { status: 500 }
    );
  }
}

function getCurrentWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}
