import { NextRequest, NextResponse } from 'next/server'

// Helper function to get database pool
function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }

    const pool = getPool()
    let actualUserId: number;

    if (userId) {
      actualUserId = parseInt(userId);
    } else if (email) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actualUserId = userResult.rows[0].id;
    } else {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }
    
    // Get all task groups and tasks for the user
    const query = `
      SELECT 
        tg.id as group_id,
        tg.title as group_title,
        tg.color as group_color,
        tg.position as group_position,
        tg.is_default,
        t.id as task_id,
        t.title as task_title,
        t.description as task_description,
        t.priority as task_priority,
        t.assignee as task_assignee,
        t.due_date as task_due_date,
        t.tags as task_tags,
        t.position as task_position,
        t.status as task_status,
        t.created_at as task_created_at,
        t.updated_at as task_updated_at
      FROM task_groups tg
      LEFT JOIN tasks t ON tg.id = t.group_id AND t.status = 'active'
      WHERE tg.user_id = $1
      ORDER BY tg.position, t.position
    `
    
    const result = await pool.query(query, [actualUserId])
    
    // Group the results by task groups
    const groups = new Map()
    
    result.rows.forEach((row: any) => {
      const groupId = row.group_id
      
      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          title: row.group_title,
          color: row.group_color,
          position: row.group_position,
          is_default: row.is_default,
          tasks: []
        })
      }
      
      if (row.task_id) {
        groups.get(groupId).tasks.push({
          id: row.task_id,
          title: row.task_title,
          description: row.task_description,
          priority: row.task_priority,
          assignee: row.task_assignee,
          due_date: row.task_due_date,
          tags: row.task_tags || [],
          position: row.task_position,
          status: row.task_status,
          created_at: row.task_created_at,
          updated_at: row.task_updated_at
        })
      }
    })
    
    await pool.end()
    
    return NextResponse.json({
      success: true,
      groups: Array.from(groups.values())
    })
    
  } catch (error) {
    console.error('Error fetching task activity data:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }

    const body = await request.json()
    const { action, data } = body
    
    const pool = getPool()
    let actualUserId: number;

    if (userId) {
      actualUserId = parseInt(userId);
    } else if (email) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      actualUserId = userResult.rows[0].id;
    } else {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }
    
    switch (action) {
      case 'create_task':
        const { group_id, title, description } = data
        
        // Get next position for the task
        const positionQuery = `
          SELECT COALESCE(MAX(position), 0) + 1 as next_position
          FROM tasks
          WHERE group_id = $1 AND status = 'active'
        `
        const positionResult = await pool.query(positionQuery, [group_id])
        const nextPosition = positionResult.rows[0].next_position
        
        // Create the task
        const createTaskQuery = `
          INSERT INTO tasks (
            user_id, group_id, title, description, priority, 
            assignee, due_date, tags, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `
        
        const taskResult = await pool.query(createTaskQuery, [
          actualUserId,
          group_id,
          title || 'New Task',
          description || 'Task description',
          'normal',
          'Unassigned',
          new Date().toISOString().split('T')[0],
          [],
          nextPosition
        ])
        
        await pool.end()
        
        return NextResponse.json({
          success: true,
          task: taskResult.rows[0]
        })
        
      case 'create_group':
        const { title: groupTitle, color } = data
        
        // Get next position for the group
        const groupPositionQuery = `
          SELECT COALESCE(MAX(position), 0) + 1 as next_position
          FROM task_groups
          WHERE user_id = $1
        `
        const groupPositionResult = await pool.query(groupPositionQuery, [actualUserId])
        const nextGroupPosition = groupPositionResult.rows[0].next_position
        
        // Create the group
        const createGroupQuery = `
          INSERT INTO task_groups (user_id, title, color, position)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `
        
        const groupResult = await pool.query(createGroupQuery, [
          actualUserId,
          groupTitle,
          color || 'bg-purple-50 dark:bg-purple-950/20',
          nextGroupPosition
        ])
        
        await pool.end()
        
        return NextResponse.json({
          success: true,
          group: groupResult.rows[0]
        })
        
      case 'move_task':
        const { task_id, new_group_id, target_position } = data
        
        console.log('Moving task:', { task_id, new_group_id, target_position })
        
        // Start a transaction
        const client = await pool.connect()
        
        try {
          await client.query('BEGIN')
          
          // Check if the task exists and belongs to the user
          const taskCheckQuery = `
            SELECT id, group_id, position 
            FROM tasks 
            WHERE id = $1 AND user_id = $2 AND status = 'active'
          `
          const taskCheckResult = await client.query(taskCheckQuery, [task_id, actualUserId])
          
          if (taskCheckResult.rows.length === 0) {
            throw new Error('Task not found or not accessible')
          }
          
          const currentTask = taskCheckResult.rows[0]
          console.log('Current task:', currentTask)
          
          // If moving to a different group, re-index the source group first
          if (currentTask.group_id !== parseInt(new_group_id)) {
            console.log('Moving to different group, re-indexing source group')
            const reindexSourceQuery = `
              UPDATE tasks 
              SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE group_id = $1 AND status = 'active' AND position > $2
            `
            await client.query(reindexSourceQuery, [currentTask.group_id, currentTask.position])
            console.log(`Re-indexed source group ${currentTask.group_id}`)
          }
          
          // If target_position is provided, we need to reorder tasks
          if (target_position !== undefined && target_position > 0) {
            console.log('Moving to specific position:', target_position)
            
            // Check if we're moving within the same group
            if (currentTask.group_id === parseInt(new_group_id)) {
              console.log('Moving within same group')
              
              // For same group moves, we need to handle the position shift differently
              if (currentTask.position < target_position) {
                // Moving down: shift tasks between current and target positions down by 1
                const shiftQuery = `
                  UPDATE tasks 
                  SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                  WHERE group_id = $1 AND status = 'active' AND position > $2 AND position <= $3
                `
                await client.query(shiftQuery, [new_group_id, currentTask.position, target_position])
              } else if (currentTask.position > target_position) {
                // Moving up: shift tasks between target and current positions up by 1
                const shiftQuery = `
                  UPDATE tasks 
                  SET position = position + 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                  WHERE group_id = $1 AND status = 'active' AND position >= $2 AND position < $3
                `
                await client.query(shiftQuery, [new_group_id, target_position, currentTask.position])
              }
            } else {
              console.log('Moving to different group')
              
              // Moving to different group: shift all tasks at and after the target position up by 1
              // But first, check if the task is already in this group
              const existingTaskQuery = `
                SELECT position FROM tasks 
                WHERE id = $1 AND group_id = $2 AND status = 'active'
              `
              const existingTaskResult = await client.query(existingTaskQuery, [task_id, new_group_id])
              
              if (existingTaskResult.rows.length > 0) {
                // Task is already in this group, handle same-group move
                const existingPosition = existingTaskResult.rows[0].position
                console.log(`Task already in group at position ${existingPosition}, moving to ${target_position}`)
                
                if (existingPosition < target_position) {
                  // Moving down: shift tasks between current and target positions down by 1
                  const shiftQuery = `
                    UPDATE tasks 
                    SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                    WHERE group_id = $1 AND status = 'active' AND position > $2 AND position <= $3
                  `
                  await client.query(shiftQuery, [new_group_id, existingPosition, target_position])
                } else if (existingPosition > target_position) {
                  // Moving up: shift tasks between target and current positions up by 1
                  const shiftQuery = `
                    UPDATE tasks 
                    SET position = position + 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                    WHERE group_id = $1 AND status = 'active' AND position >= $2 AND position < $3
                  `
                  await client.query(shiftQuery, [new_group_id, target_position, existingPosition])
                }
              } else {
                // Task is moving from a different group, shift all tasks at and after target position
                const shiftQuery = `
                  UPDATE tasks 
                  SET position = position + 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                  WHERE group_id = $1 AND status = 'active' AND position >= $2
                `
                await client.query(shiftQuery, [new_group_id, target_position])
              }
            }
            
            // Move the task to the target position
            const moveTaskQuery = `
              UPDATE tasks 
              SET group_id = $1, position = $2, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE id = $3 AND user_id = $4
              RETURNING *
            `
            
            const moveResult = await client.query(moveTaskQuery, [
              new_group_id,
              target_position,
              task_id,
              actualUserId
            ])
            
            await client.query('COMMIT')
            
            console.log('Task moved successfully:', moveResult.rows[0])
            
            return NextResponse.json({
              success: true,
              task: moveResult.rows[0]
            })
          } else {
            console.log('Moving to end of group')
            
            // If moving to a different group, re-index the source group first
            if (currentTask.group_id !== parseInt(new_group_id)) {
              console.log('Moving to different group, re-indexing source group')
              const reindexSourceQuery = `
                UPDATE tasks 
                SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                WHERE group_id = $1 AND status = 'active' AND position > $2
              `
              await client.query(reindexSourceQuery, [currentTask.group_id, currentTask.position])
              console.log(`Re-indexed source group ${currentTask.group_id}`)
            }
            
            // If no target position, just add to the end
            const movePositionQuery = `
              SELECT COALESCE(MAX(position), 0) + 1 as next_position
              FROM tasks
              WHERE group_id = $1 AND status = 'active'
            `
            const movePositionResult = await client.query(movePositionQuery, [new_group_id])
            const moveNextPosition = movePositionResult.rows[0].next_position
            
            console.log('Next position:', moveNextPosition)
            
            // Move the task
            const moveTaskQuery = `
              UPDATE tasks 
              SET group_id = $1, position = $2, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE id = $3 AND user_id = $4
              RETURNING *
            `
            
            const moveResult = await client.query(moveTaskQuery, [
              new_group_id,
              moveNextPosition,
              task_id,
              actualUserId
            ])
            
            await client.query('COMMIT')
            
            console.log('Task moved successfully:', moveResult.rows[0])
            
            return NextResponse.json({
              success: true,
              task: moveResult.rows[0]
            })
          }
        } catch (error) {
          console.error('Error in move_task:', error)
          await client.query('ROLLBACK')
          return NextResponse.json({ 
            error: 'Failed to move task', 
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        } finally {
          client.release()
          await pool.end()
        }
        
      case 'reorder_groups':
        const { group_positions } = data
        
        console.log('Reordering groups:', group_positions)
        
        const reorderClient = await pool.connect()
        
        try {
          await reorderClient.query('BEGIN')
          
          // Update positions for all groups
          for (const groupPos of group_positions) {
            const updateQuery = `
              UPDATE task_groups 
              SET position = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE id = $2 AND user_id = $3
            `
            await reorderClient.query(updateQuery, [groupPos.position, groupPos.id, actualUserId])
          }
          
          await reorderClient.query('COMMIT')
          
          console.log('Groups reordered successfully')
          
          return NextResponse.json({
            success: true,
            message: 'Groups reordered successfully'
          })
          
        } catch (error) {
          console.error('Error reordering groups:', error)
          await reorderClient.query('ROLLBACK')
          return NextResponse.json({ 
            error: 'Failed to reorder groups', 
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        } finally {
          reorderClient.release()
          await pool.end()
        }
        
      default:
        await pool.end()
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Error in task activity API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 