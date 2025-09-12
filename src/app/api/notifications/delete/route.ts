import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, initializeDatabase } from '@/lib/database-server'

export async function POST(req: NextRequest) {
  try {
    await initializeDatabase()
    const body = await req.json()
    const { id, ids, email } = body

    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 })
    }

    // Handle both single ID and array of IDs
    const notificationIds = ids || (id ? [id] : [])
    
    if (notificationIds.length === 0) {
      return NextResponse.json({ success: false, error: 'id or ids are required' }, { status: 400 })
    }

    
    // Create placeholders for the IN clause
    const placeholders = notificationIds.map((_: any, index: number) => `$${index + 2}`).join(',')
    
    const result = await executeQuery<any>(
      `UPDATE notifications 
       SET clear = true, created_at = NOW()
       WHERE id IN (${placeholders}) AND user_id = (SELECT id FROM users WHERE email = $1)
       RETURNING id`,
      [email, ...notificationIds]
    )
    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'No notifications found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deletedCount: result.length })
  } catch (error: any) {
    console.error('Error deleting notification:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}