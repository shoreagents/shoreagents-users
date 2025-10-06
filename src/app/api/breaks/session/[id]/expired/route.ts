import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/database-server';
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionId = parseInt(id);
    
    if (isNaN(sessionId)) {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    // Check if the break session is expired
    const result = await executeQuery(
      'SELECT is_break_session_expired($1) as is_expired',
      [sessionId]
    );

    return NextResponse.json({
      isExpired: result[0].is_expired
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
