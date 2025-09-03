import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Create a single pool instance that persists across requests
let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool(databaseConfig);
  }
  return pool;
};

export async function POST(request: NextRequest) {
  try {
    const pool = getPool();
    const body = await request.json();
    const { action, userId, email, weeksToKeep = 1 } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const actualUserId = userResult.rows[0].id;

    switch (action) {
      case 'get_all':
        // Check Redis cache first
        const cacheKey = cacheKeys.weeklyActivity(email, weeksToKeep)
        const cachedData = await redisCache.get(cacheKey)
        
        if (cachedData) {
          console.log('✅ Weekly activity served from Redis cache')
          return NextResponse.json(cachedData)
        }

        // Single request to get all weekly data - aggregation now happens automatically via triggers!
        const allWeekStart = await getWeekStartDate(pool);
        const allWeekEnd = await getWeekEndDate(pool);
        
        // 1. Data is already aggregated automatically via database triggers
        // 2. Cleanup old daily records (this still needs to happen periodically)
        const allCleanupResult = await pool.query(
          'SELECT cleanup_old_daily_activity($1) as deleted_count',
          [weeksToKeep]
        );
        const allDeletedCount = allCleanupResult.rows[0].deleted_count;
        
        // 3. Get weekly summary for the user
        const allSummaryResult = await pool.query(
          'SELECT * FROM get_user_weekly_summary($1) ORDER BY week_start_date DESC LIMIT 10',
          [actualUserId]
        );
        
        // 4. Get current week's daily data
        const allCurrentWeekResult = await pool.query(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, allWeekStart, allWeekEnd]
        );
        
        const responseData = {
          message: 'Weekly data retrieved and processed',
          weeklySummaries: allSummaryResult.rows,
          currentWeek: allCurrentWeekResult.rows,
          weekStart: allWeekStart,
          weekEnd: allWeekEnd,
          deletedRecords: allDeletedCount,
          weeksKept: weeksToKeep
        }

        // Cache the result in Redis
        await redisCache.set(cacheKey, responseData, cacheTTL.weeklyActivity)
        console.log('✅ Weekly activity cached in Redis')

        return NextResponse.json(responseData);

      case 'aggregate':
        // Aggregate current week's daily data into weekly summary
        await pool.query('SELECT aggregate_weekly_activity()');
        
        return NextResponse.json({ 
          message: 'Weekly aggregation completed',
          weekStart: await getWeekStartDate(pool),
          weekEnd: await getWeekEndDate(pool)
        });

      case 'cleanup':
        // Cleanup old daily records after weekly aggregation
        const cleanupResult = await pool.query(
          'SELECT cleanup_old_daily_activity($1) as deleted_count',
          [weeksToKeep]
        );
        const deletedCount = cleanupResult.rows[0].deleted_count;
        
        return NextResponse.json({ 
          message: 'Cleanup completed',
          deletedRecords: deletedCount,
          weeksKept: weeksToKeep
        });

      case 'get_summary':
        // Get weekly summary for the user
        const summaryResult = await pool.query(
          'SELECT * FROM get_user_weekly_summary($1) ORDER BY week_start_date DESC LIMIT 10',
          [actualUserId]
        );
        
        return NextResponse.json({
          weeklySummaries: summaryResult.rows
        });

      case 'get_current_week':
        // Get current week's daily data
        const weekStart = await getWeekStartDate(pool);
        const weekEnd = await getWeekEndDate(pool);
        
        const currentWeekResult = await pool.query(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, weekStart, weekEnd]
        );
        
        return NextResponse.json({
          currentWeek: currentWeekResult.rows,
          weekStart,
          weekEnd
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in weekly activity API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getWeekStartDate(pool: any): Promise<string> {
  const result = await pool.query('SELECT get_week_start_date() as week_start');
  return result.rows[0].week_start;
}

async function getWeekEndDate(pool: any): Promise<string> {
  const result = await pool.query('SELECT get_week_end_date() as week_end');
  return result.rows[0].week_end;
} 