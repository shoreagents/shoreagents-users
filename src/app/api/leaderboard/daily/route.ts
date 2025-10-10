import { NextRequest, NextResponse } from 'next/server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';
import { executeQuery } from '@/lib/database-server';

// Ensure Node.js runtime for pg
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // Default to today
    const limit = parseInt(searchParams.get('limit') || '50'); // Increased limit to see all team members

    // Check Redis cache first
    const cacheKey = `leaderboard:daily:${date}:${limit}`
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // Get daily leaderboard data using activity_data table
    const dailyLeaderboardQuery = `
      SELECT 
        u.id as user_id,
        u.email,
        pi.first_name,
        pi.last_name,
        pi.profile_picture,
        COALESCE(ad.today_active_seconds, 0) as today_active_seconds,
        COALESCE(ad.today_inactive_seconds, 0) as today_inactive_seconds,
        -- Calculate daily points: active points - inactive points (1 hour = 1 point)
        GREATEST(0, ROUND((COALESCE(ad.today_active_seconds, 0) - COALESCE(ad.today_inactive_seconds, 0)) / 3600.0, 1)) as daily_points,
        COALESCE(ad.is_currently_active, false) as is_currently_active,
        -- Check if user is on break (from break_sessions)
        CASE WHEN bs.id IS NOT NULL AND bs.end_time IS NULL THEN true ELSE false END as is_in_break
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = $1::date
      LEFT JOIN break_sessions bs ON u.id = bs.agent_user_id AND bs.end_time IS NULL
      WHERE u.user_type = 'Agent' 
      ORDER BY daily_points DESC NULLS LAST, u.id
      LIMIT $2
    `;

    const leaderboardResult = await executeQuery(dailyLeaderboardQuery, [date, limit]);
    
    // Transform the data to match the expected format
    const leaderboard = (leaderboardResult as any[]).map((row: any, index: number) => ({
      rank: index + 1,
      userId: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown User',
      profilePicture: row.profile_picture || '',
      productivityScore: parseFloat(row.daily_points || 0), // Use daily_points as productivity score
      totalActiveTime: parseInt(row.today_active_seconds || 0),
      totalInactiveTime: parseInt(row.today_inactive_seconds || 0),
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
              GREATEST(0, ROUND((COALESCE(ad.today_active_seconds, 0) - COALESCE(ad.today_inactive_seconds, 0)) / 3600.0, 1)) as daily_points,
              ROW_NUMBER() OVER (ORDER BY GREATEST(0, ROUND((COALESCE(ad.today_active_seconds, 0) - COALESCE(ad.today_inactive_seconds, 0)) / 3600.0, 1)) DESC, u.id) as rank
            FROM users u
            LEFT JOIN agents a ON u.id = a.user_id
            LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = $1::date
            WHERE u.user_type = 'Agent'
          )
          SELECT rank FROM ranked_users WHERE email = $2
        `;
        
        const rankResult = await executeQuery(userRankQuery, [date, userEmail]);
        if (rankResult.length > 0) {
          currentUserRank = rankResult[0].rank;
        }
      } catch (error) {
        console.error('Error getting user rank:', error);
      }
    }

    // Get today's date from activity data for display
    let todayDate = date;
    if (leaderboard.length > 0) {
      // Try to get today_date from the first user's activity data
      const todayDateQuery = `
        SELECT DISTINCT today_date::text as today_date
        FROM activity_data 
        WHERE today_date = $1::date
        LIMIT 1
      `;
      const todayDateResult = await executeQuery(todayDateQuery, [date]);
      if (todayDateResult.length > 0) {
        todayDate = todayDateResult[0].today_date;
      }
    }

    const responseData = {
      success: true,
      leaderboard,
      currentUserRank,
      date,
      todayDate,
      type: 'daily'
    }

    // Cache the result in Redis (shorter cache for daily data)
    await redisCache.set(cacheKey, responseData, 5 * 60) // 5 minutes cache

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Daily Leaderboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily leaderboard data' },
      { status: 500 }
    );
  }
}
