import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

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
    const { action, userId, email, monthYear, monthsBack = 12 } = body;

    // Debug logging removed to clean up console

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Get user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      console.log('❌ PRODUCTIVITY API: User not found for email:', email);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const actualUserId = userResult.rows[0].id;
    // User ID logging removed

    switch (action) {
      case 'get_all':
        // Single request to get all productivity data
        const currentMonthYear = await getCurrentMonthYear(pool);
        
        // 1. Get user's productivity scores history
        const allScoresResult = await pool.query(
          'SELECT * FROM get_user_productivity_scores($1, $2)',
          [actualUserId, monthsBack]
        );
        
        // 2. Get user's average productivity score
        const allAvgResult = await pool.query(
          'SELECT get_user_average_productivity($1, $2) as average_score',
          [actualUserId, monthsBack]
        );
        const allAverageScore = allAvgResult.rows[0].average_score;
        
        // 3. Get current month's productivity score (no need to recalculate - triggers handle this automatically)
        // Productivity scores are now updated automatically via database triggers when activity_data changes
        
        // Now get the updated productivity score
        const allCurrentScoreResult = await pool.query(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, currentMonthYear]
        );
        
        let allCurrentMonthScore;
        if (allCurrentScoreResult.rows.length > 0) {
          const rawScore = allCurrentScoreResult.rows[0];
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
            await pool.query('SELECT calculate_monthly_productivity_score($1)', [actualUserId]);
            
            // Get the newly created record
            const fallbackResult = await pool.query(
              'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
              [actualUserId, currentMonthYear]
            );
            
            if (fallbackResult.rows.length > 0) {
              allCurrentMonthScore = {
                month_year: currentMonthYear,
                productivity_score: fallbackResult.rows[0].productivity_score,
                active_hours: (fallbackResult.rows[0].total_active_seconds || 0) / 3600,
                inactive_hours: (fallbackResult.rows[0].total_inactive_seconds || 0) / 3600,
                total_hours: (fallbackResult.rows[0].total_seconds || 0) / 3600
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
            console.log('Fallback productivity calculation failed:', error instanceof Error ? error.message : String(error));
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
        
        return NextResponse.json({
          message: 'Productivity data retrieved and processed',
          productivityScores: allScoresResult.rows,
          currentMonthScore: allCurrentMonthScore,
          averageProductivityScore: allAverageScore,
          monthsBack
        });

      case 'calculate_score':
        // Calculate productivity score for current month or specified month
        const scoreResult = await pool.query(
          'SELECT calculate_monthly_productivity_score($1, $2) as productivity_score',
          [actualUserId, monthYear || null]
        );
        const score = scoreResult.rows[0].productivity_score;
        
        return NextResponse.json({ 
          message: 'Productivity score calculated',
          productivityScore: score,
          monthYear: monthYear || await getCurrentMonthYear(pool)
        });

      case 'get_scores':
        // Get user's productivity scores history
        const scoresResult = await pool.query(
          'SELECT * FROM get_user_productivity_scores($1, $2)',
          [actualUserId, monthsBack]
        );
        
        return NextResponse.json({
          productivityScores: scoresResult.rows
        });

      case 'get_average':
        // Get user's average productivity score
        const avgResult = await pool.query(
          'SELECT get_user_average_productivity($1, $2) as average_score',
          [actualUserId, monthsBack]
        );
        const averageScore = avgResult.rows[0].average_score;
        
        return NextResponse.json({
          averageProductivityScore: averageScore,
          monthsBack
        });

      case 'get_current_month_score':
        // Get current month's productivity score (no need to recalculate - triggers handle this automatically)
        const scoreCurrentMonthYear = await getCurrentMonthYear(pool);
        
        // Productivity scores are now updated automatically via database triggers when activity_data changes
        
        const currentScoreResult = await pool.query(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, scoreCurrentMonthYear]
        );
        
        if (currentScoreResult.rows.length > 0) {
          const rawScore = currentScoreResult.rows[0];
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
            await pool.query('SELECT calculate_monthly_productivity_score($1)', [actualUserId]);
            
            // Get the newly created record
            const fallbackResult = await pool.query(
              'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
              [actualUserId, scoreCurrentMonthYear]
            );
            
            if (fallbackResult.rows.length > 0) {
              const rawScore = fallbackResult.rows[0];
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
            console.log('Fallback productivity calculation failed:', error instanceof Error ? error.message : String(error));
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

async function getCurrentMonthYear(pool: any): Promise<string> {
  const result = await pool.query('SELECT get_month_year() as month_year');
  return result.rows[0].month_year;
} 