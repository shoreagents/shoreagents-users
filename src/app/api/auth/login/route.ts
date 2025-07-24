import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase, executeQuery } from '@/lib/database-server'
import * as bcrypt from 'bcryptjs'

interface LoginRequest {
  email: string
  password: string
}

interface User {
  id: number
  email: string
  user_type: 'Agent' | 'Client' | 'Internal'
  created_at: string
  updated_at: string
}

interface Password {
  id: number
  user_id: number
  password: string
  created_at: string
  updated_at: string
}

interface PersonalInfo {
  id: number
  user_id: number
  first_name: string
  middle_name?: string
  last_name: string
  nickname?: string
  profile_picture?: string
  phone?: string
  birthday?: string
  city?: string
  address?: string
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say'
  created_at: string
  updated_at: string
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: LoginRequest = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Initialize database connection
    await initializeDatabase()

    // Query to get user and password information
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

    // Prepare user data for response
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

    return NextResponse.json({
      success: true,
      user: userData,
      message: 'Login successful'
    })

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