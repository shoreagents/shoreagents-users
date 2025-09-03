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
    const { action, userId, email, monthsToKeep = 1 } = body;

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
        const cacheKey = cacheKeys.monthlyActivity(email, monthsToKeep)
        const cachedData = await redisCache.get(cacheKey)
        
        if (cachedData) {
          console.log('✅ Monthly activity served from Redis cache')
          return NextResponse.json(cachedData)
        }

        // Single request to get all monthly data - aggregation now happens automatically via triggers!
        const allMonthStart = await getMonthStartDate(pool);
        const allMonthEnd = await getMonthEndDate(pool);
        
        // 1. Data is already aggregated automatically via database triggers
        // 2. Cleanup old daily records (this still needs to happen periodically)
        const allCleanupResult = await pool.query(
          'SELECT cleanup_old_daily_activity_monthly($1) as deleted_count',
          [monthsToKeep]
        );
        const allDeletedCount = allCleanupResult.rows[0].deleted_count;
        
        // 3. Get monthly summary for the user
        const allSummaryResult = await pool.query(
          'SELECT * FROM get_user_monthly_summary($1) ORDER BY month_start_date DESC LIMIT 12',
          [actualUserId]
        );
        
        // 4. Get current month's daily data
        const allCurrentMonthResult = await pool.query(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, allMonthStart, allMonthEnd]
        );
        
        const responseData = {
          message: 'Monthly data retrieved and processed',
          monthlySummaries: allSummaryResult.rows,
          currentMonth: allCurrentMonthResult.rows,
          monthStart: allMonthStart,
          monthEnd: allMonthEnd,
          deletedRecords: allDeletedCount,
          monthsKept: monthsToKeep
        }

        // Cache the result in Redis
        await redisCache.set(cacheKey, responseData, cacheTTL.monthlyActivity)
        console.log('✅ Monthly activity cached in Redis')

        return NextResponse.json(responseData);

      case 'aggregate':
        // Aggregate current month's daily data into monthly summary
        await pool.query('SELECT aggregate_monthly_activity()');
        
        return NextResponse.json({ 
          message: 'Monthly aggregation completed',
          monthStart: await getMonthStartDate(pool),
          monthEnd: await getMonthEndDate(pool)
        });

      case 'cleanup':
        // Cleanup old daily records after monthly aggregation
        const cleanupResult = await pool.query(
          'SELECT cleanup_old_daily_activity_monthly($1) as deleted_count',
          [monthsToKeep]
        );
        const deletedCount = cleanupResult.rows[0].deleted_count;
        
        return NextResponse.json({ 
          message: 'Cleanup completed',
          deletedRecords: deletedCount,
          monthsKept: monthsToKeep
        });

      case 'get_summary':
        // Get monthly summary for the user
        const summaryResult = await pool.query(
          'SELECT * FROM get_user_monthly_summary($1) ORDER BY month_start_date DESC LIMIT 12',
          [actualUserId]
        );
        
        return NextResponse.json({
          monthlySummaries: summaryResult.rows
        });

      case 'get_current_month':
        // Get current month's daily data
        const monthStart = await getMonthStartDate(pool);
        const monthEnd = await getMonthEndDate(pool);
        
        const currentMonthResult = await pool.query(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, monthStart, monthEnd]
        );
        
        return NextResponse.json({
          currentMonth: currentMonthResult.rows,
          monthStart,
          monthEnd
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in monthly activity API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getMonthStartDate(pool: any): Promise<string> {
  const result = await pool.query('SELECT get_month_start_date() as month_start');
  return result.rows[0].month_start;
}

async function getMonthEndDate(pool: any): Promise<string> {
  const result = await pool.query('SELECT get_month_end_date() as month_end');
  return result.rows[0].month_end;
} 