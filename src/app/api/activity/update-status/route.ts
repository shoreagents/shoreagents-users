import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email parameter is required' 
      }, { status: 400 })
    }

    // Get user ID
    const userResult = await executeQuery('SELECT id FROM users WHERE email = $1', [email])
    if (userResult.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const userId = userResult[0].id
    
    // Parse request body with error handling
    let isCurrentlyActive: boolean = false // Default to inactive
    
    try {
      // Get the raw text first to check if there's actually content
      const text = await request.text()
      
      if (text && text.trim().length > 0) {
        const body = JSON.parse(text)
        isCurrentlyActive = body.isCurrentlyActive || false
      }
    } catch (error) {
      // If JSON parsing fails, default to false (inactive) for logout
      console.warn('Could not parse request body, defaulting to inactive:', error)
      isCurrentlyActive = false
    }

    if (typeof isCurrentlyActive !== 'boolean') {
      return NextResponse.json({ 
        success: false, 
        error: 'isCurrentlyActive must be a boolean' 
      }, { status: 400 })
    }

    // Update the activity_data table using UPSERT (INSERT ... ON CONFLICT)
    await executeQuery(
      `INSERT INTO activity_data (
        user_id, 
        is_currently_active, 
        today_date, 
        today_active_seconds, 
        today_inactive_seconds, 
        created_at, 
        updated_at
      ) VALUES ($1, $2, (NOW() AT TIME ZONE 'Asia/Manila')::date, 0, 0, NOW(), NOW())
      ON CONFLICT (user_id, today_date) 
      DO UPDATE SET 
        is_currently_active = EXCLUDED.is_currently_active,
        updated_at = NOW()`,
      [userId, isCurrentlyActive]
    )

    return NextResponse.json({ 
      success: true, 
      message: `Activity status updated to ${isCurrentlyActive ? 'active' : 'inactive'}` 
    })

  } catch (error) {
    console.error('Error updating activity status:', error)
    return NextResponse.json(
      { error: 'Failed to update activity status' }, 
      { status: 500 }
    )
  }
}
