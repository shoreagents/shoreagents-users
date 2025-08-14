import { NextRequest, NextResponse } from 'next/server';

// Ensure Node.js runtime for pg
export const runtime = 'nodejs';

// Lazy pg import to avoid edge bundling; cache pool across requests
function getPool() {
  const g: any = globalThis as any;
  if (!g.__leaderboard_pg_pool) {
    const { Pool } = require('pg');
    g.__leaderboard_pg_pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }
  return g.__leaderboard_pg_pool as any;
}

export async function GET(request: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = new URL(request.url);
    const monthYear = searchParams.get('month') || await getCurrentMonthYear(pool);
    const limit = parseInt(searchParams.get('limit') || '10');
    let memberIdParam = searchParams.get('member_id');

    // Try to infer member_id from authenticated user if not provided
    if (!memberIdParam) {
      try {
        // Prefer cookie
        const authCookie = request.cookies.get('shoreagents-auth')?.value;
        let userEmail: string | null = null;
        if (authCookie) {
          let authData: any = null;
          try {
            authData = JSON.parse(decodeURIComponent(authCookie));
          } catch {
            try { authData = JSON.parse(authCookie); } catch { authData = null; }
          }
          userEmail = authData?.user?.email || null;
        } else {
          // Fallback to Authorization header JSON (legacy)
          const authHeader = request.headers.get('authorization');
          if (authHeader) {
            const authData = JSON.parse(authHeader.replace('Bearer ', ''));
            userEmail = authData?.user?.email || null;
          }
        }

        if (userEmail) {
          const memberIdRes = await pool.query(
            `SELECT a.member_id
             FROM users u
             JOIN agents a ON a.user_id = u.id
             WHERE u.email = $1
             LIMIT 1`,
            [userEmail]
          );
          if (memberIdRes.rows.length > 0) {
            memberIdParam = String(memberIdRes.rows[0].member_id);
          }
        }
      } catch (e) {
        // ignore and proceed without member filter
      }
    }

    // Get current month/year for Philippines timezone
    const currentMonthYear = await getCurrentMonthYear(pool);

    // Get leaderboard data for the specified month
    const leaderboardQuery = `
      SELECT 
        u.id as user_id,
        u.email,
        pi.first_name,
        pi.last_name,
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
      ${memberIdParam ? 'AND a.member_id = $2' : ''}
      ORDER BY ps.productivity_score DESC NULLS LAST, u.id
      LIMIT ${memberIdParam ? '$3' : '$2'}
    `;

    const leaderboardParams: any[] = [monthYear];
    if (memberIdParam) leaderboardParams.push(parseInt(memberIdParam));
    leaderboardParams.push(limit);

    const leaderboardResult = await pool.query(leaderboardQuery, leaderboardParams);
    
    // Transform the data to match the expected format
    const leaderboard = (leaderboardResult.rows as any[]).map((row: any, index: number) => ({
      rank: index + 1,
      userId: row.email,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unknown User',
      productivityScore: parseFloat(row.productivity_score || 0),
      totalActiveTime: parseInt(row.total_active_seconds || 0),
      totalInactiveTime: parseInt(row.total_inactive_seconds || 0),
      isCurrentlyActive: row.is_currently_active || false,
      isInBreak: row.is_in_break || false
    }));

    // Get current user's rank if authenticated (and within same member scope when applicable)
    const authHeader = request.headers.get('authorization');
    let currentUserRank = 0;
    
    if (authHeader) {
      try {
        let userEmail: string | null = null;
        try {
          const authData = JSON.parse(authHeader.replace('Bearer ', ''));
          userEmail = authData?.user?.email || null;
        } catch {
          userEmail = null;
        }
        
        if (userEmail) {
          const userRankQuery = `
            SELECT 
              ROW_NUMBER() OVER (ORDER BY COALESCE(ps.productivity_score, 0) DESC NULLS LAST) as rank
            FROM users u
            LEFT JOIN agents a ON u.id = a.user_id
            LEFT JOIN productivity_scores ps ON u.id = ps.user_id AND ps.month_year = $1
            WHERE u.email = $2 AND u.user_type = 'Agent' 
            ${memberIdParam ? 'AND a.member_id = $3' : ''}
          `;
          
          const rankParams: any[] = [monthYear, userEmail];
          if (memberIdParam) rankParams.push(parseInt(memberIdParam));
          const rankResult = await pool.query(userRankQuery, rankParams);
          if (rankResult.rows.length > 0) {
            currentUserRank = rankResult.rows[0].rank;
          }
        }
      } catch (error) {
        console.log('Error parsing auth header:', error);
      }
    }

    return NextResponse.json({
      success: true,
      leaderboard,
      currentUserRank,
      monthYear,
      currentMonthYear,
      memberId: memberIdParam ? parseInt(memberIdParam) : null
    });

  } catch (error) {
    console.error('❌ Leaderboard API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard data' },
      { status: 500 }
    );
  }
}

async function getCurrentMonthYear(pool: any): Promise<string> {
  const result = await pool.query("SELECT get_month_year() as month_year");
  return result.rows[0].month_year;
} 