import { NextResponse } from 'next/server'
import { forceDailyReset, debugDailyReset } from '@/lib/activity-storage'
import { getCurrentUser } from '@/lib/ticket-utils'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId is required'
      }, { status: 400 })
    }
    
    console.log(`🔄 Force reset requested for user: ${userId}`)
    
    // Debug the current state
    debugDailyReset(userId)
    
    // Force the reset
    forceDailyReset(userId)
    
    return NextResponse.json({
      success: true,
      message: `Daily reset triggered for user: ${userId}`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Reset API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'userId query parameter is required'
      }, { status: 400 })
    }
    
    // Debug the current state
    debugDailyReset(userId)
    
    return NextResponse.json({
      success: true,
      message: `Debug info logged for user: ${userId}`,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Debug API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 