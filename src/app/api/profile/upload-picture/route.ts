import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { initializeDatabase, executeQuery } from '@/lib/database-server'
import { redisCache, cacheKeys } from '@/lib/redis-cache'

// Server-side Supabase client with service role key
let supabaseAdmin: any = null

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  return supabaseAdmin
}

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
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

    return {
      id: authData.user.railway_id || authData.user.id,
      email: authData.user.email,
      name: authData.user.name,
      role: authData.user.role,
      user_type: authData.user.user_type
    }
  } catch (error) {
    console.error('Error parsing auth cookie:', error)
    return null
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Initialize database connection
    await initializeDatabase()

    // Get current profile picture URL from database
    const getCurrentPictureQuery = 'SELECT profile_picture FROM personal_info WHERE user_id = $1'
    const currentPictureResult = await executeQuery(getCurrentPictureQuery, [user.id])

    if (currentPictureResult.length === 0) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const currentProfilePicture = currentPictureResult[0].profile_picture

    // Delete from Supabase bucket if there's a current profile picture
    if (currentProfilePicture) {
      try {
        const admin = getSupabaseAdmin()
        
        // Extract the file path from the URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/avatars/profile-pictures/[userId]/[filename]
        const urlParts = currentProfilePicture.split('/avatars/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          
          // Delete the file from Supabase storage
          const { error: deleteError } = await admin.storage
            .from('avatars')
            .remove([filePath])

          if (deleteError) {
            console.warn('Failed to delete file from Supabase storage:', deleteError)
            // Continue with database update even if file deletion fails
          }
        }
      } catch (storageError) {
        console.warn('Error deleting from Supabase storage:', storageError)
        // Continue with database update even if storage deletion fails
      }
    }

    // Update the database to remove the profile picture
    const updateQuery = 'UPDATE personal_info SET profile_picture = NULL WHERE user_id = $1'
    
    try {
      await executeQuery(updateQuery, [user.id])
    } catch (updateError) {
      console.error('Error removing profile picture from database:', updateError)
      return NextResponse.json(
        { error: 'Failed to remove profile picture from database' },
        { status: 500 }
      )
    }

    // Invalidate Redis cache for this user
    try {
      // Get user email for cache invalidation
      const emailQuery = 'SELECT email FROM users WHERE id = $1'
      const emailResult = await executeQuery(emailQuery, [user.id])
      
      if (emailResult.length > 0) {
        const userEmail = emailResult[0].email
        await redisCache.del(cacheKeys.profile(userEmail))
        await redisCache.del(cacheKeys.profileById(parseInt(user.id)))
        
        // Invalidate leaderboard cache to refresh profile pictures
        await redisCache.invalidatePattern('leaderboard:*')
        
        // Invalidate ticket comments cache to refresh profile pictures
        await redisCache.invalidatePattern('ticket-comments:*')
      }
    } catch (cacheError) {
      console.warn('Failed to invalidate cache:', cacheError)
      // Don't fail the request if cache invalidation fails
    }

    return NextResponse.json({
      success: true,
      message: 'Profile picture removed successfully'
    })

  } catch (error) {
    console.error('Error in profile picture removal API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to remove profile picture',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('profilePicture') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No profile picture provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Please upload an image smaller than 5MB.' },
        { status: 400 }
      )
    }

    // Initialize database connection
    await initializeDatabase()

    // Get current profile picture URL from database
    const getCurrentPictureQuery = 'SELECT profile_picture FROM personal_info WHERE user_id = $1'
    const currentPictureResult = await executeQuery(getCurrentPictureQuery, [user.id])

    if (currentPictureResult.length === 0) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    const currentProfilePicture = currentPictureResult[0].profile_picture

    // Delete old profile picture from Supabase if it exists
    if (currentProfilePicture) {
      try {
        const admin = getSupabaseAdmin()
        
        // Extract the file path from the URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/avatars/profile-pictures/[userId]/[filename]
        const urlParts = currentProfilePicture.split('/avatars/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          
          // Delete the old file from Supabase storage
          const { error: deleteError } = await admin.storage
            .from('avatars')
            .remove([filePath])

          if (deleteError) {
            console.warn('Failed to delete old profile picture from Supabase storage:', deleteError)
            // Continue with new upload even if old file deletion fails
          }
        }
      } catch (storageError) {
        console.warn('Error deleting old profile picture from Supabase storage:', storageError)
        // Continue with new upload even if old file deletion fails
      }
    }

    try {
      // Create a unique filename for the profile picture
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const filePath = `profile-pictures/${user.id}/${timestamp}.${fileExtension}`

      // Convert File to Buffer for server-side upload
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload file using service role key
      const admin = getSupabaseAdmin()
      const { data, error } = await admin.storage
        .from('avatars') // Using the avatars bucket for profile pictures
        .upload(filePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true // Allow overwriting existing files
        })

      if (error) {
        console.error('Error uploading profile picture:', error)
        return NextResponse.json(
          { error: 'Failed to upload profile picture' },
          { status: 500 }
        )
      }

      // Get the public URL
      const { data: urlData } = admin.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Update the profile_picture field in personal_info table
      const updateQuery = 'UPDATE personal_info SET profile_picture = $1 WHERE user_id = $2'
      const updateParams = [urlData.publicUrl, user.id]
      
      try {
        await executeQuery(updateQuery, updateParams)
      } catch (updateError) {
        console.error('Error updating profile picture in database:', updateError)
        return NextResponse.json(
          { error: 'Failed to update profile picture in database' },
          { status: 500 }
        )
      }

      // Invalidate Redis cache for this user
      try {
        // Get user email for cache invalidation
        const emailQuery = 'SELECT email FROM users WHERE id = $1'
        const emailResult = await executeQuery(emailQuery, [user.id])
        
        if (emailResult.length > 0) {
          const userEmail = emailResult[0].email
          await redisCache.del(cacheKeys.profile(userEmail))
          await redisCache.del(cacheKeys.profileById(parseInt(user.id)))
          
          // Invalidate leaderboard cache to refresh profile pictures
          // We need to invalidate all leaderboard caches since we don't know which month/year is cached
          await redisCache.invalidatePattern('leaderboard:*')
          
          // Invalidate ticket comments cache to refresh profile pictures
          await redisCache.invalidatePattern('ticket-comments:*')
        }
      } catch (cacheError) {
        console.warn('Failed to invalidate cache:', cacheError)
        // Don't fail the request if cache invalidation fails
      }

      return NextResponse.json({
        success: true,
        profilePictureUrl: urlData.publicUrl,
        message: 'Profile picture uploaded successfully'
      })

    } catch (error) {
      console.error('Error processing profile picture:', error)
      return NextResponse.json(
        { error: 'Failed to process profile picture' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in profile picture upload API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload profile picture',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
