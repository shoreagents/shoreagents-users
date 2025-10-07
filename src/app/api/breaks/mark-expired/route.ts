import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';
export async function POST(request: NextRequest) {
  try {
    // Mark expired breaks for all users
    const result = await executeQuery('SELECT mark_expired_breaks() as count');
    
    // Get all break sessions with their expiration status from the last 7 days
    // This includes sessions that might have been marked as expired on previous days
    const sessionsResult = await executeQuery(`
      SELECT 
        bs.id,
        bs.agent_user_id,
        bs.break_type,
        bs.break_date,
        bs.is_expired,
        is_break_session_expired(bs.id) as is_expired_check
      FROM break_sessions bs
      WHERE bs.break_date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY bs.id DESC
    `);
    
    return NextResponse.json({
      success: true,
      expiredCount: result[0].count,
      sessions: sessionsResult.map(session => ({
        id: session.id,
        agent_user_id: session.agent_user_id,
        break_type: session.break_type,
        break_date: session.break_date,
        is_expired: session.is_expired || session.is_expired_check
      }))
    });

  } catch (error) {
    console.error('❌ Database error:', error);
    
    // Return a more specific error message based on the error type
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        return NextResponse.json(
          { error: 'Database connection temporarily unavailable. Please try again.' },
          { status: 503 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
