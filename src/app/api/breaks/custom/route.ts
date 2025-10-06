import { NextRequest, NextResponse } from 'next/server'
import { validateBreakSchedule } from '@/lib/break-validation'

function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id')

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    // Get user's custom break settings
    const query = `
      SELECT break_type, start_time, end_time, duration_minutes
      FROM public.breaks
      WHERE user_id = $1 AND is_active = true
      ORDER BY break_type
    `
    
    const pool = getPool()
    const result = await pool.query(query, [userId])
    await pool.end()
    
    return NextResponse.json({
      success: true,
      breaks: result.rows
    })

  } catch (error) {
    console.error('Error fetching custom breaks:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch custom breaks' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_id, break_settings } = body

    if (!user_id || !break_settings || !Array.isArray(break_settings)) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and break settings are required' 
      }, { status: 400 })
    }

    // Validate break settings
    for (const setting of break_settings) {
      if (!setting.break_type || !setting.start_time || !setting.end_time || !setting.duration_minutes) {
        return NextResponse.json({ 
          success: false, 
          error: 'Each break setting must have break_type, start_time, end_time, and duration_minutes' 
        }, { status: 400 })
      }
    }

    // Get user's shift time for validation
    let shiftTime = ''
    
    try {
      const pool1 = getPool()
      const shiftResult = await pool1.query(`
        SELECT ji.shift_time 
        FROM job_info ji
        LEFT JOIN agents a ON ji.agent_user_id = a.user_id
        WHERE (ji.agent_user_id = $1 OR ji.internal_user_id = $1)
        AND ji.shift_time IS NOT NULL
        LIMIT 1
      `, [user_id])
      await pool1.end()
      
      if (shiftResult.rows.length > 0) {
        shiftTime = shiftResult.rows[0].shift_time || ''
      }
    } catch (shiftError) {
      console.warn('Could not fetch shift time for validation:', shiftError)
    }

    // Get existing breaks for overlap validation
    let existingBreaks = []
    try {
      const pool2 = getPool()
      const existingBreaksResult = await pool2.query(`
        SELECT break_type, start_time, end_time, duration_minutes
        FROM public.breaks
        WHERE user_id = $1 AND is_active = true
      `, [user_id])
      await pool2.end()
      
      existingBreaks = existingBreaksResult.rows
    } catch (existingBreaksError) {
      console.warn('Could not fetch existing breaks for validation:', existingBreaksError)
    }

    // Validate break schedule against shift time and check for overlaps
    if (shiftTime) {
      // Create a map to avoid duplicates when updating existing breaks
      const breakMap = new Map()
      
      // Add existing breaks to the map
      existingBreaks.forEach((breakItem: any) => {
        breakMap.set(breakItem.break_type, breakItem)
      })
      
      // Add/update with new breaks
      break_settings.forEach((breakItem: any) => {
        breakMap.set(breakItem.break_type, breakItem)
      })
      
      // Convert map back to array for validation
      const allBreaks = Array.from(breakMap.values())
      
      const validation = validateBreakSchedule(allBreaks, shiftTime)
      
      if (!validation.isValid) {
        return NextResponse.json({
          success: false,
          error: 'Break schedule validation failed',
          details: validation.errors,
          warnings: validation.warnings
        }, { status: 400 })
      }
      
      // Log warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Break schedule warnings:', validation.warnings)
      }
    }

    // Update individual break settings instead of replacing all
    try {
      for (const setting of break_settings) {
        // Check if a break of this type already exists for this user
        const pool3 = getPool()
        const existingBreak = await pool3.query(`
          SELECT id FROM public.breaks 
          WHERE user_id = $1 AND break_type = $2 AND is_active = true
        `, [user_id, setting.break_type])
        await pool3.end()
        
        if (existingBreak.rows.length > 0) {
          // Update existing break
          const pool4 = getPool()
          await pool4.query(`
            UPDATE public.breaks 
            SET start_time = $3, end_time = $4, duration_minutes = $5, updated_at = now()
            WHERE user_id = $1 AND break_type = $2 AND is_active = true
          `, [
            user_id,
            setting.break_type,
            setting.start_time,
            setting.end_time,
            setting.duration_minutes
          ])
          await pool4.end()
        } else {
          // Insert new break setting
          const pool5 = getPool()
          await pool5.query(`
            INSERT INTO public.breaks (
              user_id,
              break_type,
              start_time,
              end_time,
              duration_minutes,
              is_active
            ) VALUES ($1, $2, $3, $4, $5, true)
          `, [
            user_id,
            setting.break_type,
            setting.start_time,
            setting.end_time,
            setting.duration_minutes
          ])
          await pool5.end()
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'Break settings updated successfully'
      })
    } catch (error) {
      throw error
    }

  } catch (error) {
    console.error('Error setting custom breaks:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to set custom breaks' 
    }, { status: 500 })
  }
}
