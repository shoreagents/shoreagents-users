import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, getDatabaseClient } from '@/lib/database-server'

// Helper function to get user from request
function getUserFromRequest(request: NextRequest) {
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
}

// GET: Retrieve all ticket categories
export async function GET(request: NextRequest) {
  try {
    // Get user from request
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      )
    }

    // Get all ticket categories using shared connection
    const categoriesQuery = `
      SELECT 
        id,
        name,
        created_at,
        updated_at
      FROM ticket_categories
      ORDER BY name ASC
    `

    const result = await executeQuery(categoriesQuery)

    const categories = result.map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at?.toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) || '',
      updatedAt: row.updated_at?.toLocaleString('en-US', { 
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }) || ''
    }))

    return NextResponse.json({
      success: true,
      categories,
      total: categories.length
    })

  } catch (error) {
    console.error('Error fetching ticket categories:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch ticket categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// POST: Create a new ticket category
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

    // Parse request body
    const body = await request.json()
    const { name } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    // Check if category already exists
    const existingCategoryQuery = 'SELECT id FROM ticket_categories WHERE name = $1'
    const existingResult = await executeQuery(existingCategoryQuery, [name])
    
    if (existingResult.length > 0) {
      return NextResponse.json(
        { error: 'Category already exists' },
        { status: 409 }
      )
    }

    // Create new category
    const createCategoryQuery = `
      INSERT INTO ticket_categories (name, created_at, updated_at)
      VALUES ($1, NOW() AT TIME ZONE 'Asia/Manila', NOW() AT TIME ZONE 'Asia/Manila')
      RETURNING id, name, created_at, updated_at
    `

    const result = await executeQuery(createCategoryQuery, [name])
    const newCategory = result[0]

    return NextResponse.json({
      success: true,
      category: {
        id: newCategory.id,
        name: newCategory.name,
        createdAt: newCategory.created_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || '',
        updatedAt: newCategory.updated_at?.toLocaleString('en-US', { 
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }) || ''
      }
    })

  } catch (error) {
    console.error('Error creating ticket category:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create ticket category',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
