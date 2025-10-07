import { NextRequest, NextResponse } from 'next/server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';
import { executeQuery } from '@/lib/database-server';

// Ensure Node.js runtime for pg
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('month') || await getCurrentMonthYear();
    const limit = parseInt(searchParams.get('limit') || '10');

    // Check Redis cache first
    const cacheKey = cacheKeys.leaderboard(limit, monthYear)
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }
    // Remove member ID filtering - let client-side handle team filtering

    // Get current month/year for Philippines timezone
    const currentMonthYear = await getCurrentMonthYear();

    // Get leaderboard data for the specified month
    let leaderboardQuery: string;
    let leaderboardParams: any[];
    
    try {
      // Try to use productivity_scores table first
      leaderboardQuery = `
        SELECT 
          u.id as user_id,
          u.email,
          pi.first_name,
          pi.last_name,
          pi.profile_picture,
          COALESCE(ps.productivity_score, 0) as productivity_score,
          COALESCE(ps.total_active_seconds, 0) as total_active_seconds,
          COALESCE(ps.total_inactive_seconds, 0) as total_inactive_seconds,
          COALESCE(ps.total_seconds, 0) as total_seconds,
          COALESCE(ps.active_percentage, 0) as active_percentage,
          -- Check if user is currently active (from activity_data)
          COALESCE(ad.is_currently_active, false) as is_currently_active,
          -- Check if user is on break (from break_sessions)
          CASE WHEN bs.id IS NOT NULL AND bs.end_time IS NULL THEN true ELSE false END as is_in_break
        FROM users u
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        LEFT JOIN productivity_scores ps ON u.id = ps.user_id AND ps.month_year = $1
        LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
        LEFT JOIN break_sessions bs ON u.id = bs.agent_user_id AND bs.end_time IS NULL
        WHERE u.user_type = 'Agent' 
        ORDER BY ps.productivity_score DESC NULLS LAST, u.id
        LIMIT $2
      `;
      
      leaderboardParams = [monthYear, limit];
      
      // Test if productivity_scores table exists
      await executeQuery('SELECT 1 FROM productivity_scores LIMIT 1');
      
    } catch (error) {
      // Fallback to basic user list if productivity_scores table doesn't exist
      leaderboardQuery = `
        SELECT 
          u.id as user_id,
          u.email,
          pi.first_name,
          pi.last_name,
          pi.profile_picture,
          0 as productivity_score,
          0 as total_active_seconds,
          0 as total_inactive_seconds,
          0 as total_seconds,
          0 as active_percentage,
          false as is_currently_active,
          false as is_in_break
        FROM users u
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        WHERE u.user_type = 'Agent' 
        ORDER BY u.id
        LIMIT $1
      `;
      
      leaderboardParams = [limit];
    }



    const leaderboardResult = await executeQuery(leaderboardQuery, leaderboardParams);
    
    // Transform the data to match the expected format
    const leaderboard = (leaderboardResult as any[]).map((row: any, index: number) => ({
      rank: index + 1,
      userId: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown User',
      profilePicture: row.profile_picture || '',
      productivityScore: parseFloat(row.productivity_score || 0),
      totalActiveTime: parseInt(row.total_active_seconds || 0),
      totalInactiveTime: parseInt(row.total_inactive_seconds || 0),
      isCurrentlyActive: row.is_currently_active || false,
      isInBreak: row.is_in_break || false
    }));

    // Get current user's rank if authenticated (and within same member scope when applicable)
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
        let userRankQuery: string;
        let rankParams: any[];
        
        try {
          // Test if productivity_scores table exists
          await executeQuery('SELECT 1 FROM productivity_scores LIMIT 1');
          
          userRankQuery = `
            WITH ranked_users AS (
              SELECT 
                u.id,
                u.email,
                ROW_NUMBER() OVER (ORDER BY COALESCE(ps.productivity_score, 0) DESC NULLS LAST) as rank
              FROM users u
              LEFT JOIN agents a ON u.id = a.user_id
              LEFT JOIN productivity_scores ps ON u.id = ps.user_id AND ps.month_year = $1
              WHERE u.user_type = 'Agent'
            )
            SELECT rank FROM ranked_users WHERE email = $2
          `;
          
          rankParams = [monthYear, userEmail];
          
        } catch (error) {
          // Fallback if productivity_scores table doesn't exist
          userRankQuery = `
            WITH ranked_users AS (
              SELECT 
                u.id,
                u.email,
                ROW_NUMBER() OVER (ORDER BY u.id) as rank
              FROM users u
              LEFT JOIN agents a ON u.id = a.user_id
              WHERE u.user_type = 'Agent'
            )
            SELECT rank FROM ranked_users WHERE email = $1
          `;
          
          rankParams = [userEmail];
        }
        
        const rankResult = await executeQuery(userRankQuery, rankParams);
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
      monthYear,
      currentMonthYear
    }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.leaderboard)

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Leaderboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}

async function getCurrentMonthYear(): Promise<string> {
  try {
    // Try to use the database function first
    const result = await executeQuery("SELECT get_month_year() as month_year");
    return result[0].month_year;
  } catch (error) {
    // Fallback to manual calculation if function doesn't exist
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${year}-${month}`;
  }
} 