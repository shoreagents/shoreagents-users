import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { initializeDatabase, executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys } from '@/lib/redis-cache'
import * as bcrypt from 'bcryptjs'

interface LoginRequest {
  email: string
  password: string
  fallback?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequest = await request.json()
    const { email, password, fallback } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // If fallback is explicitly requested, use Railway authentication only
    if (fallback) {
      // Initialize database connection
      await initializeDatabase()

      // Query to get user and password information from Railway database
      const userQuery = `
        SELECT 
          u.id, u.email, u.user_type, u.created_at, u.updated_at,
          p.password as password_hash,
          pi.first_name, pi.middle_name, pi.last_name, pi.nickname, 
          pi.profile_picture, pi.phone, pi.birthday, pi.city, pi.address, pi.gender
        FROM users u
        LEFT JOIN passwords p ON u.id = p.user_id
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        WHERE u.email = $1
        LIMIT 1
      `

      const result = await executeQuery(userQuery, [email])

      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      const userRecord = result[0]

      // Check if password exists
      if (!userRecord.password_hash) {
        return NextResponse.json(
          { success: false, error: 'User account not properly configured' },
          { status: 401 }
        )
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, userRecord.password_hash)

      if (!passwordMatch) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Check if user is an Agent - only agents can login to this app
      if (userRecord.user_type !== 'Agent') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Access denied. This application is restricted to Agent users only.',
            userType: userRecord.user_type 
          },
          { status: 403 }
        )
      }

      // Prepare user data for response (Railway format)
      const userData = {
        id: userRecord.id,
        email: userRecord.email,
        user_type: userRecord.user_type,
        name: `${userRecord.first_name || ''} ${userRecord.last_name || ''}`.trim() || userRecord.email,
        first_name: userRecord.first_name,
        middle_name: userRecord.middle_name,
        last_name: userRecord.last_name,
        nickname: userRecord.nickname,
        profile_picture: userRecord.profile_picture,
        phone: userRecord.phone,
        birthday: userRecord.birthday,
        city: userRecord.city,
        address: userRecord.address,
        gender: userRecord.gender,
        role: userRecord.user_type.toLowerCase() // For compatibility with existing code
      }

      // Also set app auth cookie server-side to avoid race conditions on first redirect
      const authData = {
        isAuthenticated: true,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
          user_type: userData.user_type,
        },
        timestamp: new Date().toISOString(),
        usingFallback: true,
      }

      // Invalidate user auth data cache to ensure real-time updates
      try {
        await redisCache.del(cacheKeys.userAuthData(email))
      } catch (cacheError) {
        console.warn('Failed to invalidate user auth data cache:', cacheError)
      }

      const resFallback = NextResponse.json({
        success: true,
        user: userData,
        message: 'Login successful (Railway fallback)',
        fallback: true
      })
      resFallback.cookies.set(
        'shoreagents-auth',
        encodeURIComponent(JSON.stringify(authData)),
        { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }
      )
      return resFallback
    }

    // Get Supabase admin client
    const admin = supabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Authentication service not configured. Please contact administrator.' },
        { status: 500 }
      )
    }

    // Step 1: Authenticate with Supabase
    const { data, error } = await admin.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 }
      )
    }

    // Step 2: Check Railway database for user role and profile
    await initializeDatabase()

    const railwayUserQuery = `
      SELECT 
        u.id, u.email, u.user_type, u.created_at, u.updated_at,
        pi.first_name, pi.middle_name, pi.last_name, pi.nickname, 
        pi.profile_picture, pi.phone, pi.birthday, pi.city, pi.address, pi.gender
      FROM users u
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE u.email = $1
      LIMIT 1
    `

    const railwayResult = await executeQuery(railwayUserQuery, [email])

    if (railwayResult.length === 0) {
      // Email exists in Supabase but not in Railway - sign them out
      await admin.auth.admin.signOut(data.session.access_token)
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found in system records. Please contact administrator.',
        },
        { status: 403 }
      )
    }

    const railwayUser = railwayResult[0]

    // Step 3: Verify email matches between Supabase and Railway
    if (railwayUser.email.toLowerCase() !== data.user.email!.toLowerCase()) {
      // Email mismatch - security issue
      await admin.auth.admin.signOut(data.session.access_token)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication error. Please contact administrator.',
        },
        { status: 403 }
      )
    }

    // Step 4: Check if user is an Agent in Railway database
    if (railwayUser.user_type !== 'Agent') {
      // Sign out from Supabase since they're not an agent
      await admin.auth.admin.signOut(data.session.access_token)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Access denied. This application is restricted to Agent users only.',
          userType: railwayUser.user_type 
        },
        { status: 403 }
      )
    }

    // Step 5: Prepare user data for response (combining Supabase ID with Railway profile)
    const userData = {
      id: data.user.id, // Use Supabase UUID
      railway_id: railwayUser.id, // Keep Railway ID for compatibility
      email: data.user.email!,
      user_type: railwayUser.user_type,
      name: `${railwayUser.first_name || ''} ${railwayUser.last_name || ''}`.trim() || data.user.email!,
      first_name: railwayUser.first_name,
      middle_name: railwayUser.middle_name,
      last_name: railwayUser.last_name,
      nickname: railwayUser.nickname,
      profile_picture: railwayUser.profile_picture,
      phone: railwayUser.phone,
      birthday: railwayUser.birthday,
      city: railwayUser.city,
      address: railwayUser.address,
      gender: railwayUser.gender,
      role: 'agent' // For compatibility with existing code
    }

    // Also set our app auth cookie server-side to avoid needing a second login
    const authData = {
      isAuthenticated: true,
      user: {
        id: userData.id,
        railway_id: userData.railway_id,
        email: userData.email,
        name: userData.name,
        role: userData.role,
        user_type: userData.user_type,
      },
      timestamp: new Date().toISOString(),
      hybrid: true,
    }

    // Invalidate user auth data cache to ensure real-time updates
    try {
      await redisCache.del(cacheKeys.userAuthData(email))
    } catch (cacheError) {
      console.warn('Failed to invalidate user auth data cache:', cacheError)
    }

    const resHybrid = NextResponse.json({
      success: true,
      user: userData,
      message: 'Login successful (Supabase + Railway validation)',
      session: data.session,
      hybrid: true
    })
    resHybrid.cookies.set(
      'shoreagents-auth',
      encodeURIComponent(JSON.stringify(authData)),
      { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }
    )
    return resHybrid

  } catch (error) {
    console.error('Login API error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 