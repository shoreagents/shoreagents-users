import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { initializeDatabase, executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Server-side Supabase client with service role key
const supabaseAdmin = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
}) : null

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  try {
    const { email } = await params
    const decodedEmail = decodeURIComponent(email)
    
    if (!decodedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Check Redis cache first
    const cacheKey = cacheKeys.userAuthData(decodedEmail)
    const cachedData = await redisCache.get(cacheKey)
    
    if (cachedData) {
      return NextResponse.json(cachedData)
    }
    // Step 1: First try to find user in Supabase Auth
    let user = null
    let authSource = 'supabase'
    
    if (supabaseAdmin) {
      try {
        // Use listUsers with higher limit to get more users
        const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
          perPage: 1000, // Increase limit to get more users
          page: 1
        })
        
        if (error) {
          console.error('Auth error:', error)
        } else if (users?.users) {
          // Try exact match first
          user = users.users.find(u => u.email === decodedEmail)
          
          if (!user) {
            // Try case-insensitive match
            user = users.users.find(u => u.email && u.email.toLowerCase() === decodedEmail.toLowerCase())
          }
          
          if (user) {
            authSource = 'supabase'
          }
        }
      } catch (supabaseError) {
        console.warn('Auth check failed, falling back to Railway database:', supabaseError)
      }
    }

    // Step 2: If not found in Supabase, check Railway database
    if (!user) {
      try {
        await initializeDatabase()
        
        const railwayUserQuery = `
          SELECT 
            u.id, u.email, u.user_type, u.created_at, u.updated_at
          FROM users u
          WHERE u.email = $1
          LIMIT 1
        `
        
        const railwayResult = await executeQuery(railwayUserQuery, [decodedEmail])
        
        if (railwayResult.length > 0) {
          const railwayUser = railwayResult[0]
          // Create a compatible user object for Railway users
          user = {
            id: railwayUser.id.toString(),
            email: railwayUser.email,
            created_at: railwayUser.created_at,
            updated_at: railwayUser.updated_at,
            last_sign_in_at: null,
            email_confirmed_at: null,
            invited_at: null,
            confirmation_sent_at: null
          }
          authSource = 'railway'
        }
      } catch (railwayError) {
        console.error('Database check failed:', railwayError)
      }
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Extract relevant authentication information
    const authData = {
      id: user.id,
      email: user.email,
      last_sign_in_at: user.last_sign_in_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_confirmed_at: user.email_confirmed_at,
      invited_at: user.invited_at,
      confirmation_sent_at: user.confirmation_sent_at,
      is_authenticated: true,
      auth_source: authSource
    }

    const responseData = {
      success: true,
      data: authData
    }

    // Cache the result in Redis
    await redisCache.set(cacheKey, responseData, cacheTTL.userAuthData)

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error in auth-status API:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
