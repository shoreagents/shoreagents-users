import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, initializeDatabase } from '@/lib/database-server'

export async function POST(req: NextRequest) {
  try {
    await initializeDatabase()
    const body = await req.json()
    const { id, email } = body

    console.log('🗑️ Delete API called with:', { id, email })

    if (!id || !email) {
      return NextResponse.json({ success: false, error: 'id and email are required' }, { status: 400 })
    }

    // Delete the notification (soft delete by setting clear = true)
    console.log('🗑️ Executing delete query...')
    const result = await executeQuery<any>(
      `UPDATE notifications 
       SET clear = true, created_at = NOW()
       WHERE id = $1 AND user_id = (SELECT id FROM users WHERE email = $2)
       RETURNING id`,
      [id, email]
    )

    console.log('🗑️ Delete query result:', result)

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Notification not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('🗑️ Error deleting notification:', error)
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}