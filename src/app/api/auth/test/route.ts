import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check authentication from cookie
    const authCookie = request.cookies.get('shoreagents-auth')?.value
    
    if (!authCookie) {
      return NextResponse.json({
        success: false,
        error: 'No authentication cookie found',
        authenticated: false
      })
    }

    let authData
    try {
      authData = JSON.parse(authCookie)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid authentication cookie',
        authenticated: false
      })
    }

    // Check if user is authenticated and is an agent
    const isAuthenticated = authData.isAuthenticated === true
    const isAgent = authData.user?.user_type === 'Agent'

    return NextResponse.json({
      success: true,
      authenticated: isAuthenticated,
      isAgent: isAgent,
      user: authData.user,
      message: isAuthenticated 
        ? (isAgent ? 'Authenticated agent user' : 'Authenticated non-agent user') 
        : 'Not authenticated'
    })

  } catch (error) {
    console.error('Auth test error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      authenticated: false
    }, { status: 500 })
  }
} 