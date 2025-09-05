import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase, executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

interface ProfileRequest {
  userId?: number
  email?: string
}

export async function GET(request: NextRequest) {
  try {
    // Get user ID or email from query parameters or headers
    const searchParams = request.nextUrl.searchParams
    const userIdParam = searchParams.get('userId')
    const emailParam = searchParams.get('email')
    
    // Also check for authentication in headers/cookies
    const authCookie = request.cookies.get('shoreagents-auth')?.value
    let currentUserEmail = emailParam

    if (!currentUserEmail && authCookie) {
      try {
        const authData = JSON.parse(authCookie)
        currentUserEmail = authData.user?.email
      } catch {
        // Continue with other methods
      }
    }

    if (!userIdParam && !currentUserEmail) {
      return NextResponse.json(
        { success: false, error: 'User ID or email is required' },
        { status: 400 }
      )
    }

    // Check Redis cache first
    const cacheKey = userIdParam 
      ? cacheKeys.profileById(parseInt(userIdParam))
      : cacheKeys.profile(currentUserEmail!)
    
    const cachedProfile = await redisCache.get(cacheKey)
    if (cachedProfile) {
      console.log('✅ Profile served from Redis cache')
      return NextResponse.json({
        success: true,
        profile: cachedProfile,
        cached: true
      })
    }

    // Initialize database connection
    await initializeDatabase()

    // Build comprehensive query to get user, personal info, job info, and member info
    let query: string
    let params: any[]

    if (userIdParam) {
      query = `
        SELECT 
          u.id, u.email, u.user_type, u.created_at, u.updated_at,
          pi.first_name, pi.middle_name, pi.last_name, pi.nickname, 
          pi.profile_picture, pi.phone, pi.birthday, pi.city, pi.address, pi.gender,
          pi.created_at as profile_created_at, pi.updated_at as profile_updated_at,
          -- Job information
          ji.employee_id, ji.job_title, ji.shift_period, ji.shift_schedule, ji.shift_time,
          ji.work_setup, ji.employment_status, ji.hire_type, ji.staff_source,
          ji.start_date as job_start_date, ji.exit_date,
          -- Member/Company information
          m.company, m.address as company_address, m.phone as company_phone,
          m.logo as company_logo, m.service, m.status as member_status,
          m.badge_color, m.country, m.website,
          -- Agent/Client specific info
          a.exp_points, a.department_id as agent_department_id,
          c.department_id as client_department_id
        FROM users u
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN clients c ON u.id = c.user_id
        LEFT JOIN members m ON (a.member_id = m.id OR c.member_id = m.id)
        LEFT JOIN job_info ji ON (ji.agent_user_id = a.user_id OR ji.internal_user_id = u.id)
        WHERE u.id = $1
        LIMIT 1
      `
      params = [parseInt(userIdParam)]
    } else {
      query = `
        SELECT 
          u.id, u.email, u.user_type, u.created_at, u.updated_at,
          pi.first_name, pi.middle_name, pi.last_name, pi.nickname, 
          pi.profile_picture, pi.phone, pi.birthday, pi.city, pi.address, pi.gender,
          pi.created_at as profile_created_at, pi.updated_at as profile_updated_at,
          -- Job information
          ji.employee_id, ji.job_title, ji.shift_period, ji.shift_schedule, ji.shift_time,
          ji.work_setup, ji.employment_status, ji.hire_type, ji.staff_source,
          ji.start_date as job_start_date, ji.exit_date,
          -- Member/Company information
          m.company, m.address as company_address, m.phone as company_phone,
          m.logo as company_logo, m.service, m.status as member_status,
          m.badge_color, m.country, m.website,
          -- Agent/Client specific info
          a.exp_points, a.department_id as agent_department_id,
          c.department_id as client_department_id
        FROM users u
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN clients c ON u.id = c.user_id
        LEFT JOIN members m ON (a.member_id = m.id OR c.member_id = m.id)
        LEFT JOIN job_info ji ON (ji.agent_user_id = a.user_id OR ji.internal_user_id = u.id)
        WHERE u.email = $1
        LIMIT 1
      `
      params = [currentUserEmail]
    }

    const result = await executeQuery(query, params)

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      )
    }

    const userRecord = result[0]

    // Format the profile data to match the expected interface
    const profileData = {
      number: userRecord.id.toString(),
      id_number: userRecord.employee_id || userRecord.id.toString(),
      last_name: userRecord.last_name || '',
      first_name: userRecord.first_name || '',
      middle_name: userRecord.middle_name || '',
      gender: userRecord.gender || '',
      phone: userRecord.phone || '',
      email: userRecord.email,
      date_of_birth: userRecord.birthday ? new Date(userRecord.birthday).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }) : '',
      // Real work information from job_info table
      position: userRecord.job_title || 'Staff Member',
      employee_id: userRecord.employee_id || '',
      job_title: userRecord.job_title || '',
      shift_period: userRecord.shift_period || '',
      shift_schedule: userRecord.shift_schedule || '',
      shift_time: userRecord.shift_time || '',
      work_setup: userRecord.work_setup || '',
      employment_status: userRecord.employment_status || 'Active',
      hire_type: userRecord.hire_type || '',
      staff_source: userRecord.staff_source || '',
      start_date: userRecord.job_start_date ? new Date(userRecord.job_start_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }) : (userRecord.created_at ? new Date(userRecord.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }) : ''),
      exit_date: userRecord.exit_date ? new Date(userRecord.exit_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: '2-digit'
      }) : '',
      // Company information from members table
      company: userRecord.company || 'SHOREAGENTS',
      company_address: userRecord.company_address || '',
      company_phone: userRecord.company_phone || '',
      company_logo: userRecord.company_logo || '',
      service: userRecord.service || '',
      member_status: userRecord.member_status || '',
      badge_color: userRecord.badge_color || '',
      country: userRecord.country || '',
      website: userRecord.website || '',
      // Department info
      department_id: userRecord.agent_department_id || userRecord.client_department_id || null,
      // Experience points (for agents)
      exp_points: userRecord.exp_points || 0,
      // Legacy compatibility fields
      department: userRecord.user_type === 'Agent' ? 'OPERATIONS' : 'CLIENT SERVICES',
      status: userRecord.employment_status || 'ACTIVE',
      // Additional fields from database
      nickname: userRecord.nickname || '',
      profile_picture: userRecord.profile_picture || '',
      city: userRecord.city || '',
      address: userRecord.address || '',
      user_type: userRecord.user_type
    }

    // Cache the profile data
    await redisCache.set(cacheKey, profileData, cacheTTL.profile)

    return NextResponse.json({
      success: true,
      profile: profileData
    })

  } catch (error) {
    console.error('Profile API error:', error)
    
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, updates } = body

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, error: 'User ID or email is required' },
        { status: 400 }
      )
    }

    // Initialize database connection
    await initializeDatabase()

    // Update profile in database
    let updateQuery = ''
    let params: any[] = []

    if (userId) {
      // Update by user ID
      const updateFields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ')
      updateQuery = `UPDATE personal_info SET ${updateFields} WHERE user_id = $1`
      params = [userId, ...Object.values(updates)]
    } else {
      // Update by email
      const updateFields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ')
      updateQuery = `
        UPDATE personal_info 
        SET ${updateFields} 
        WHERE user_id = (SELECT id FROM users WHERE email = $1)
      `
      params = [email, ...Object.values(updates)]
    }

    await executeQuery(updateQuery, params)

    // Invalidate Redis cache
    const cacheKey = userId 
      ? cacheKeys.profileById(parseInt(userId))
      : cacheKeys.profile(email)
    
    await redisCache.del(cacheKey)

    // Also invalidate by email if we have userId
    if (userId) {
      // Get email for this user to invalidate email-based cache too
      const emailQuery = 'SELECT email FROM users WHERE id = $1'
      const emailResult = await executeQuery(emailQuery, [userId])
      if (emailResult.length > 0) {
        const userEmail = emailResult[0].email
        await redisCache.del(cacheKeys.profile(userEmail))
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Profile update error:', error)
    
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