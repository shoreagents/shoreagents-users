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

    // Get activity data for the current week (Saturday to Friday)
    // Calculate the start of the current week (Saturday) in Philippines timezone (UTC+8)
    const today = new Date();
    const philippinesOffset = 8 * 60; // UTC+8 in minutes
    const philippinesTime = new Date(today.getTime() + (philippinesOffset * 60 * 1000));
    
    const currentDay = philippinesTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const saturdayOffset = currentDay === 6 ? 0 : currentDay - 6 + 7; // Go back to Saturday
    const weekStart = new Date(philippinesTime);
    weekStart.setDate(philippinesTime.getDate() - saturdayOffset);
    
    // Calculate the end of the week (Friday) - 6 days after Saturday = Friday
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // For database query, adjust the date range to account for timezone offset
    // The database stores dates in UTC, but we need to query for Philippines dates
    // So we need to query one day earlier to get the correct Philippines dates
    const weekStartUTC = new Date(weekStart);
    weekStartUTC.setUTCDate(weekStartUTC.getUTCDate() - 1);
    const weekEndUTC = new Date(weekEnd);
    weekEndUTC.setUTCDate(weekEndUTC.getUTCDate() - 1);
    
    // Extend the end date to include Sep 10 (which is 2025-09-09 in UTC)
    weekEndUTC.setUTCDate(weekEndUTC.getUTCDate() + 1);
    
    const weekStartStr = weekStartUTC.toISOString().split('T')[0];
    const weekEndStr = weekEndUTC.toISOString().split('T')[0];
    
    const result = await pool.query(`
      SELECT 
        id,
        user_id,
        is_currently_active,
        today_active_seconds,
        today_inactive_seconds,
        today_date::text as today_date,
        last_session_start,
        created_at,
        updated_at
      FROM activity_data 
      WHERE user_id = $1 
        AND today_date >= $2::date
        AND today_date <= $3::date
      ORDER BY today_date DESC, created_at DESC
    `, [userId, weekStartStr, weekEndStr]);

    const activityData = result.rows;

    return NextResponse.json({
      success: true,
      data: activityData,
      count: activityData.length
    });

  } catch (error) {
    console.error('Error fetching last 7 days activity data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity data' },
      { status: 500 }
    );
  }
}
