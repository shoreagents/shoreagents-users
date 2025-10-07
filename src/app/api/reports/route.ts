import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

// Helper function to get user from request
async function getUserFromRequest(request: NextRequest) {
  try {
    // Get user from cookies (same pattern as other APIs)
    const authCookie = request.cookies.get('shoreagents-auth')
    
    if (!authCookie) {
      return null
    }

    try {
      const raw = typeof authCookie.value === 'string' ? authCookie.value : ''
      const decoded = (() => { try { return decodeURIComponent(raw) } catch { return raw } })()
      const authData = JSON.parse(decoded)
      if (!authData.isAuthenticated || !authData.user) {
        return null
      }

      // Return the user data from the cookie
      return {
        id: authData.user.railway_id || authData.user.id, // Use railway_id for database operations
        email: authData.user.email,
        name: authData.user.name,
        role: authData.user.role,
        user_type: authData.user.user_type
      }
    } catch (error) {
      console.error('Error parsing auth cookie:', error)
      return null
    }
  } catch (error) {
    console.error('Error getting user from request:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found or unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { reportType, title, description } = body

    // Validate required fields
    if (!reportType || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: reportType, title, description' },
        { status: 400 }
      )
    }

    // Validate report type
    const validReportTypes = ['bug', 'feature', 'ui', 'performance', 'account', 'other']
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      )
    }

    // Insert the report
    const result = await executeQuery(
      `INSERT INTO reports (user_id, report_type, title, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, report_type, title, created_at`,
      [user.id, reportType, title, description]
    )

    const report = result[0]

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully',
      report: {
        id: report.id,
        reportType: report.report_type,
        title: report.title,
        createdAt: report.created_at
      }
    })

  } catch (error) {
    console.error('Error submitting report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found or unauthorized' },
        { status: 401 }
      )
    }

    // Get user's reports
    const result = await executeQuery(
      `SELECT id, report_type, title, description, created_at
       FROM reports 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [user.id]
    )

    const reports = result.map(row => ({
      id: row.id,
      reportType: row.report_type,
      title: row.title,
      description: row.description,
      createdAt: row.created_at
    }))

    return NextResponse.json({
      success: true,
      reports
    })

  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
