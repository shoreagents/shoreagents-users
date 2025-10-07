import { NextRequest, NextResponse } from 'next/server';
import { executeQuery, getDatabaseClient } from '@/lib/database-server';
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, email, monthYear, monthsBack = 12 } = body;

    // Debug logging removed to clean up console

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user ID
    const userResult = await executeQuery('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const actualUserId = userResult[0].id;
    // User ID logging removed

    switch (action) {
      case 'get_all':
        // Check Redis cache first
        const cacheKey = cacheKeys.productivity(email, monthsBack)
        const cachedData = await redisCache.get(cacheKey)
        
        if (cachedData) {
          return NextResponse.json(cachedData)
        }

        // Single request to get all productivity data
        const currentMonthYear = await getCurrentMonthYear();
        
        // 1. Get user's productivity scores history
        const allScoresResult = await executeQuery(
          'SELECT * FROM get_user_productivity_scores($1, $2)',
          [actualUserId, monthsBack]
        );

        // 2. Get user's average productivity score
        const allAvgResult = await executeQuery(
          'SELECT get_user_average_productivity($1, $2) as average_score',
          [actualUserId, monthsBack]
        );
        const allAverageScore = allAvgResult[0].average_score;
        
        // 3. Get current month's productivity score (no need to recalculate - triggers handle this automatically)
        // Productivity scores are now updated automatically via database triggers when activity_data changes
        
        // Now get the updated productivity score
        const allCurrentScoreResult = await executeQuery(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, currentMonthYear]
        );
        
        let allCurrentMonthScore;
        if (allCurrentScoreResult.length > 0) {
          const rawScore = allCurrentScoreResult[0];
          // Convert seconds to hours for frontend display
          allCurrentMonthScore = {
            ...rawScore,
            active_hours: (rawScore.total_active_seconds || 0) / 3600,
            inactive_hours: (rawScore.total_inactive_seconds || 0) / 3600,
            total_hours: (rawScore.total_seconds || 0) / 3600
          };
          
          // Hours conversion logging removed
        } else {
          // Fallback if no record exists (triggers should create one automatically)
          // Try to trigger manual calculation as a safety net
          try {
            await executeQuery('SELECT calculate_monthly_productivity_score($1)', [actualUserId]);
            
            // Invalidate cache after fallback calculation
            try {
              const userResult = await executeQuery('SELECT email FROM users WHERE id = $1', [actualUserId]);
              if (userResult.length > 0) {
                const userEmail = userResult[0].email;
                
                // Invalidate productivity cache
                const productivityCacheKey = cacheKeys.productivity(userEmail, 12);
                await redisCache.del(productivityCacheKey);
                
                // Invalidate leaderboard cache
                const leaderboardCacheKey = cacheKeys.leaderboard(100, currentMonthYear);
                await redisCache.del(leaderboardCacheKey);
                
                console.log(`🗑️ Invalidated cache after fallback productivity calculation for ${userEmail}`);
              }
            } catch (cacheError) {
              console.error('Error invalidating cache after fallback calculation:', cacheError);
            }
            
            // Get the newly created record
            const fallbackResult = await executeQuery(
              'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
              [actualUserId, currentMonthYear]
            );
            
            if (fallbackResult.length > 0) {
              allCurrentMonthScore = {
                month_year: currentMonthYear,
                productivity_score: fallbackResult[0].productivity_score,
                active_hours: (fallbackResult[0].total_active_seconds || 0) / 3600,
                inactive_hours: (fallbackResult[0].total_inactive_seconds || 0) / 3600,
                total_hours: (fallbackResult[0].total_seconds || 0) / 3600
              };
            } else {
              // Return default values if all else fails
              allCurrentMonthScore = {
                month_year: currentMonthYear,
                productivity_score: 0,
                active_hours: 0,
                inactive_hours: 0,
                total_hours: 0
              };
            }
          } catch (error) {
            // Return default values if calculation fails
            allCurrentMonthScore = {
              month_year: currentMonthYear,
              productivity_score: 0,
              active_hours: 0,
              inactive_hours: 0,
              total_hours: 0
            };
          }
        }
        
        const responseData = {
          message: 'Productivity data retrieved and processed',
          productivityScores: allScoresResult,
          currentMonthScore: allCurrentMonthScore,
          averageProductivityScore: allAverageScore,
          monthsBack
        }

        // Cache the result in Redis
        await redisCache.set(cacheKey, responseData, cacheTTL.productivity)

        return NextResponse.json(responseData);

      case 'calculate_score':
        // Calculate productivity score for current month or specified month
        const scoreResult = await executeQuery(
          'SELECT calculate_monthly_productivity_score($1, $2) as productivity_score',
          [actualUserId, monthYear || null]
        );
        const score = scoreResult[0].productivity_score;
        
        // Invalidate cache after manual calculation
        try {
          const userResult = await executeQuery('SELECT email FROM users WHERE id = $1', [actualUserId]);
          if (userResult.length > 0) {
            const userEmail = userResult[0].email;
            const targetMonthYear = monthYear || await getCurrentMonthYear();
            
            // Invalidate productivity cache
            const productivityCacheKey = cacheKeys.productivity(userEmail, 12);
            await redisCache.del(productivityCacheKey);
            
            // Invalidate leaderboard cache
            const leaderboardCacheKey = cacheKeys.leaderboard(100, targetMonthYear);
            await redisCache.del(leaderboardCacheKey);
            
            console.log(`🗑️ Invalidated cache after manual productivity calculation for ${userEmail}`);
          }
        } catch (cacheError) {
          console.error('Error invalidating cache after manual calculation:', cacheError);
        }
        
        return NextResponse.json({ 
          message: 'Productivity score calculated',
          productivityScore: score,
          monthYear: monthYear || await getCurrentMonthYear()
        });

      case 'get_scores':
        // Get user's productivity scores history
        const scoresResult = await executeQuery(
          'SELECT * FROM get_user_productivity_scores($1, $2)',
          [actualUserId, monthsBack]
        );
        
        return NextResponse.json({
          productivityScores: scoresResult        });

      case 'get_average':
        // Get user's average productivity score
        const avgResult = await executeQuery(
          'SELECT get_user_average_productivity($1, $2) as average_score',
          [actualUserId, monthsBack]
        );
        const averageScore = avgResult[0].average_score;
        
        return NextResponse.json({
          averageProductivityScore: averageScore,
          monthsBack
        });

      case 'get_current_month_score':
        // Get current month's productivity score (no need to recalculate - triggers handle this automatically)
        const scoreCurrentMonthYear = await getCurrentMonthYear();
        
        // Productivity scores are now updated automatically via database triggers when activity_data changes
        
        const currentScoreResult = await executeQuery(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, scoreCurrentMonthYear]
        );
        
        if (currentScoreResult.length > 0) {
          const rawScore = currentScoreResult[0];
          // Convert seconds to hours for frontend display
          const formattedScore = {
            ...rawScore,
            active_hours: (rawScore.total_active_seconds || 0) / 3600,
            inactive_hours: (rawScore.total_inactive_seconds || 0) / 3600,
            total_hours: (rawScore.total_seconds || 0) / 3600
          };
          
          return NextResponse.json({
            currentMonthScore: formattedScore
          });
        } else {
          // Fallback if no record exists (triggers should create one automatically)
          // Try to trigger manual calculation as a safety net
          try {
            await executeQuery('SELECT calculate_monthly_productivity_score($1)', [actualUserId]);
            
            // Invalidate cache after fallback calculation
            try {
              const userResult = await executeQuery('SELECT email FROM users WHERE id = $1', [actualUserId]);
              if (userResult.length > 0) {
                const userEmail = userResult[0].email;
                
                // Invalidate productivity cache
                const productivityCacheKey = cacheKeys.productivity(userEmail, 12);
                await redisCache.del(productivityCacheKey);
                
                // Invalidate leaderboard cache
                const leaderboardCacheKey = cacheKeys.leaderboard(100, scoreCurrentMonthYear);
                await redisCache.del(leaderboardCacheKey);
                
                console.log(`🗑️ Invalidated cache after fallback productivity calculation for ${userEmail}`);
              }
            } catch (cacheError) {
              console.error('Error invalidating cache after fallback calculation:', cacheError);
            }
            
            // Get the newly created record
            const fallbackResult = await executeQuery(
              'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
              [actualUserId, scoreCurrentMonthYear]
            );
            
            if (fallbackResult.length > 0) {
              const rawScore = fallbackResult[0];
              const formattedScore = {
                ...rawScore,
                active_hours: (rawScore.total_active_seconds || 0) / 3600,
                inactive_hours: (rawScore.total_inactive_seconds || 0) / 3600,
                total_hours: (rawScore.total_seconds || 0) / 3600
              };
              
              return NextResponse.json({
                currentMonthScore: formattedScore
              });
            }
          } catch (error) {
            console.error('Fallback productivity calculation failed:', error instanceof Error ? error.message : String(error));
          }
          
          // Return default values if all else fails
          return NextResponse.json({
            currentMonthScore: {
              month_year: scoreCurrentMonthYear,
              productivity_score: 0,
              active_hours: 0,
              inactive_hours: 0,
              total_hours: 0
            }
          });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in productivity API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCurrentMonthYear(): Promise<string> {
  const result = await executeQuery('SELECT get_month_year() as month_year');
  return result[0].month_year;
} 