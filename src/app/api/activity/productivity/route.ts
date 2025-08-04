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
        
        // 3. Get current month's productivity score
        const allCurrentScoreResult = await pool.query(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, currentMonthYear]
        );
        
        let allCurrentMonthScore;
        if (allCurrentScoreResult.rows.length > 0) {
          allCurrentMonthScore = allCurrentScoreResult.rows[0];
        } else {
          // Calculate score if not exists
          const newScoreResult = await pool.query(
            'SELECT calculate_monthly_productivity_score($1) as productivity_score',
            [actualUserId]
          );
          
          allCurrentMonthScore = {
            month_year: currentMonthYear,
            productivity_score: newScoreResult.rows[0].productivity_score
          };
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
        // Get current month's productivity score
        const scoreCurrentMonthYear = await getCurrentMonthYear(pool);
        const currentScoreResult = await pool.query(
          'SELECT * FROM productivity_scores WHERE user_id = $1 AND month_year = $2',
          [actualUserId, scoreCurrentMonthYear]
        );
        
        if (currentScoreResult.rows.length > 0) {
          return NextResponse.json({
            currentMonthScore: currentScoreResult.rows[0]
          });
        } else {
          // Calculate score if not exists
          const newScoreResult = await pool.query(
            'SELECT calculate_monthly_productivity_score($1) as productivity_score',
            [actualUserId]
          );
          
          return NextResponse.json({
            currentMonthScore: {
              month_year: scoreCurrentMonthYear,
              productivity_score: newScoreResult.rows[0].productivity_score
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