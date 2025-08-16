import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, initializeDatabase } from '@/lib/database-server'

type Body = {
  id?: number | string
  ids?: Array<number | string>
  email?: string
}

export async function POST(req: NextRequest) {
  try {
    await initializeDatabase()
    const body = (await req.json()) as Body
    const email = body.email
    if (!email) {
      return NextResponse.json({ success: false, error: 'email is required' }, { status: 400 })
    }

    const rawIds: Array<number | string> = []
    if (body.id !== undefined) rawIds.push(body.id)
    if (Array.isArray(body.ids)) rawIds.push(...body.ids)
    if (rawIds.length === 0) {
      return NextResponse.json({ success: false, error: 'id or ids is required' }, { status: 400 })
    }

    // Normalize ids (strip 'db_' prefix if present)
    const ids: number[] = rawIds
      .map((v) => (typeof v === 'string' && v.startsWith('db_') ? v.slice(3) : v))
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n)) as number[]

    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: 'no valid ids' }, { status: 400 })
    }

    // Update only notifications owned by the email's user
    const updated = await executeQuery<{ id: number }>(
      `UPDATE notifications n
       SET is_read = true
       FROM users u
       WHERE n.user_id = u.id
         AND u.email = $1
         AND n.id = ANY($2::int[])
       RETURNING n.id`,
      [email, ids]
    )

    return NextResponse.json({ success: true, updatedCount: updated.length, updatedIds: updated.map((r) => r.id) })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal error' }, { status: 500 })
  }
}


