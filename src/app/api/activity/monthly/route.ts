import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, getDatabaseClient } from '@/lib/database-server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, email, monthsToKeep = 1, forceRefresh = false } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user ID
    const userResult = await executeQuery('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const actualUserId = userResult[0].id;

    switch (action) {
      case 'get_all':
        // Check Redis cache first (unless forceRefresh is true)
        const cacheKey = cacheKeys.monthlyActivity(email, monthsToKeep)
        
        if (!forceRefresh) {
          const cachedData = await redisCache.get(cacheKey)
          if (cachedData) {
            return NextResponse.json(cachedData)
          }
        }

        // Single request to get all monthly data - aggregation now happens automatically via triggers!
        const allMonthStart = await getMonthStartDate();
        const allMonthEnd = await getMonthEndDate();
        
        // 1. Data is already aggregated automatically via database triggers
        // 2. Cleanup functions removed to preserve data
        const allDeletedCount = 0; // No cleanup performed to preserve data
        
        // 3. Get monthly summary for the user
        const allSummaryResult = await executeQuery(
          'SELECT * FROM get_user_monthly_summary($1) ORDER BY month_start_date DESC LIMIT 12',
          [actualUserId]
        );
        
        // 4. Get current month's daily data
        const allCurrentMonthResult = await executeQuery(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, allMonthStart, allMonthEnd]
        );
        
        const responseData = {
          message: 'Monthly data retrieved and processed',
          monthlySummaries: allSummaryResult,
          currentMonth: allCurrentMonthResult,
          monthStart: allMonthStart,
          monthEnd: allMonthEnd,
          deletedRecords: allDeletedCount,
          monthsKept: monthsToKeep
        }

        // Cache the result in Redis
        await redisCache.set(cacheKey, responseData, cacheTTL.monthlyActivity)

        return NextResponse.json(responseData);

      case 'aggregate':
        // Aggregate current month's daily data into monthly summary
        await executeQuery('SELECT aggregate_monthly_activity()');
        
        return NextResponse.json({ 
          message: 'Monthly aggregation completed',
          monthStart: await getMonthStartDate(),
          monthEnd: await getMonthEndDate()
        });

      case 'cleanup':
        // Cleanup old daily records after monthly aggregation
        const cleanupResult = await executeQuery(
          'SELECT cleanup_old_daily_activity_monthly($1) as deleted_count',
          [monthsToKeep]
        );
        const deletedCount = cleanupResult[0].deleted_count;
        
        return NextResponse.json({ 
          message: 'Cleanup completed',
          deletedRecords: deletedCount,
          monthsKept: monthsToKeep
        });

      case 'get_summary':
        // Get monthly summary for the user
        const summaryResult = await executeQuery(
          'SELECT * FROM get_user_monthly_summary($1) ORDER BY month_start_date DESC LIMIT 12',
          [actualUserId]
        );
        
        return NextResponse.json({
          monthlySummaries: summaryResult
        });

      case 'get_current_month':
        // Get current month's daily data
        const monthStart = await getMonthStartDate();
        const monthEnd = await getMonthEndDate();
        
        const currentMonthResult = await executeQuery(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, monthStart, monthEnd]
        );
        
        return NextResponse.json({
          currentMonth: currentMonthResult,
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

async function getMonthStartDate(): Promise<string> {
  const result = await executeQuery('SELECT get_month_start_date() as month_start');
  return result[0].month_start;
}

async function getMonthEndDate(): Promise<string> {
  const result = await executeQuery('SELECT get_month_end_date() as month_end');
  return result[0].month_end;
} 