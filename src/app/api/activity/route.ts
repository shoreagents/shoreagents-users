import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the most recent activity data for the user
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        is_currently_active,
        today_active_seconds,
        today_inactive_seconds,
        today_date,
        last_session_start,
        created_at,
        updated_at
      FROM activity_data 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No activity data found for user' },
        { status: 404 }
      );
    }

    const activityData = result.rows[0];

    return NextResponse.json(activityData);

  } catch (error) {
    console.error('❌ Error fetching activity data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity data' },
      { status: 500 }
    );
  }
} 