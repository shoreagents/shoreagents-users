import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/database-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    // Check if user has custom break settings
    const query = `
      SELECT COUNT(*) as count
      FROM public.breaks
      WHERE user_id = $1 AND is_active = true
    `
    
    const result = await executeQuery(query, [userId])
    const count = parseInt(result[0].count)
    
    return NextResponse.json({
      success: true,
      hasCustomBreaks: count > 0,
      count: count
    })

  } catch (error) {
    console.error('Error checking custom breaks:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check custom breaks' 
    }, { status: 500 })
  }
}
