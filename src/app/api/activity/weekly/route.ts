import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, getDatabaseClient } from '@/lib/database-server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, email, weeksToKeep = 1, forceRefresh = false } = body;

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
        const cacheKey = cacheKeys.weeklyActivity(email, weeksToKeep)
        
        if (!forceRefresh) {
          const cachedData = await redisCache.get(cacheKey)
          if (cachedData) {
            return NextResponse.json(cachedData)
          }
        }

        // Single request to get all weekly data - aggregation now happens automatically via triggers!
        const allWeekStart = await getWeekStartDate();
        const allWeekEnd = await getWeekEndDate();
        
        // 1. Data is already aggregated automatically via database triggers
        // 2. Cleanup functions removed to preserve data
        const allDeletedCount = 0; // No cleanup performed to preserve data
        
        // 3. Get weekly summary for the user
        const allSummaryResult = await executeQuery(
          'SELECT * FROM get_user_weekly_summary($1) ORDER BY week_start_date DESC LIMIT 10',
          [actualUserId]
        );
        
        // 4. Get current week's daily data
        const allCurrentWeekResult = await executeQuery(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, allWeekStart, allWeekEnd]
        );
        
        const responseData = {
          message: 'Weekly data retrieved and processed',
          weeklySummaries: allSummaryResult,
          currentWeek: allCurrentWeekResult,
          weekStart: allWeekStart,
          weekEnd: allWeekEnd,
          deletedRecords: allDeletedCount,
          weeksKept: weeksToKeep
        }

        // Cache the result in Redis
        await redisCache.set(cacheKey, responseData, cacheTTL.weeklyActivity)

        return NextResponse.json(responseData);

      case 'aggregate':
        // Aggregate current week's daily data into weekly summary
        await executeQuery('SELECT aggregate_weekly_activity()');
        
        return NextResponse.json({ 
          message: 'Weekly aggregation completed',
          weekStart: await getWeekStartDate(),
          weekEnd: await getWeekEndDate()
        });

      case 'cleanup':
        // Cleanup old daily records after weekly aggregation
        const cleanupResult = await executeQuery(
          'SELECT cleanup_old_daily_activity($1) as deleted_count',
          [weeksToKeep]
        );
        const deletedCount = cleanupResult[0].deleted_count;
        
        return NextResponse.json({ 
          message: 'Cleanup completed',
          deletedRecords: deletedCount,
          weeksKept: weeksToKeep
        });

      case 'get_summary':
        // Get weekly summary for the user
        const summaryResult = await executeQuery(
          'SELECT * FROM get_user_weekly_summary($1) ORDER BY week_start_date DESC LIMIT 10',
          [actualUserId]
        );
        
        return NextResponse.json({
          weeklySummaries: summaryResult        });

      case 'get_current_week':
        // Get current week's daily data
        const weekStart = await getWeekStartDate();
        const weekEnd = await getWeekEndDate();
        
        const currentWeekResult = await executeQuery(
          `SELECT * FROM activity_data 
           WHERE user_id = $1 
           AND today_date BETWEEN $2 AND $3 
           ORDER BY today_date DESC`,
          [actualUserId, weekStart, weekEnd]
        );
        
        return NextResponse.json({
          currentWeek: currentWeekResult,
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

async function getWeekStartDate(): Promise<string> {
  const result = await executeQuery('SELECT get_week_start_date() as week_start');
  return result[0].week_start;
}

async function getWeekEndDate(): Promise<string> {
  const result = await executeQuery('SELECT get_week_end_date() as week_end');
  return result[0].week_end;
} 