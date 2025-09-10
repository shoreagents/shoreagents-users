import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, initializeDatabase } from '@/lib/database-server'

export async function GET(req: NextRequest) {
  try {
    await initializeDatabase()
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Math.max(Number(limitParam || 50), 1), 200)

    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 })
    }

    // Get limited notifications for display
    const rows = await executeQuery<any>(
      `SELECT n.id, n.user_id, n.category, n.type, n.title, n.message, n.payload, n.is_read, n.created_at
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE u.email = $1 AND (n.clear IS NULL OR n.clear = false)
       ORDER BY n.created_at DESC
       LIMIT $2`,
      [email, limit]
    )

    // Get total unread count
    const unreadCountResult = await executeQuery<any>(
      `SELECT COUNT(*) as unread_count
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       WHERE u.email = $1 AND (n.clear IS NULL OR n.clear = false) AND n.is_read = false`,
      [email]
    )

    const totalUnreadCount = Number(unreadCountResult[0]?.unread_count) || 0

    return NextResponse.json({ 
      success: true, 
      notifications: rows,
      totalUnreadCount: totalUnreadCount
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}


