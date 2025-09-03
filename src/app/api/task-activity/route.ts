import { NextRequest, NextResponse } from 'next/server'
import { redisCache, cacheKeys, cacheTTL } from '@/lib/redis-cache'

// Helper function to get database pool
function getPool() {
  const { Pool } = require('pg')
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
}

// Format a Date as ISO string with Asia/Manila (+08:00) offset
function toManilaIso(date: Date): string {
  const ms = date.getTime() + 8 * 60 * 60 * 1000
  const shifted = new Date(ms)
  // toISOString() yields Zulu; replace Z with +08:00 because we shifted time by +8h
  return shifted.toISOString().replace('Z', '+08:00')
}

// Convert a YYYY-MM-DD string to end-of-day in Manila time
function dateOnlyToManilaEndOfDayIso(dateOnly: string): string {
  // Basic guard; assume validated format upstream
  return `${dateOnly}T23:59:59.000+08:00`
}

// Convert a YYYY-MM-DD string to start-of-day in Manila time
function dateOnlyToManilaStartOfDayIso(dateOnly: string): string {
  return `${dateOnly}T00:00:00.000+08:00`
}

// Normalize incoming date-like value to Manila ISO. If value is date-only string, choose start or end of day.
function normalizeManilaTimestamp(value: unknown, useEndOfDayForDateOnly: boolean): string {
  if (value instanceof Date) {
    return toManilaIso(value)
  }
  if (typeof value === 'string') {
    const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/
    if (dateOnlyRegex.test(value)) {
      return useEndOfDayForDateOnly
        ? dateOnlyToManilaEndOfDayIso(value)
        : dateOnlyToManilaStartOfDayIso(value)
    }
    if (/Z|[+\-]\d{2}:?\d{2}$/.test(value)) {
      return value
    }
    // has time but no timezone → assume Manila
    const hasTime = /\d{2}:\d{2}/.test(value)
    if (hasTime) {
      return `${value.replace(/\s+/g, 'T')}+08:00`
    }
    // Fallback: treat as date-only
    return useEndOfDayForDateOnly
      ? dateOnlyToManilaEndOfDayIso(value)
      : dateOnlyToManilaStartOfDayIso(value)
  }
  // Fallback to now
  return toManilaIso(new Date())
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const bypassCache = searchParams.get('bypass_cache') === 'true';
    
    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email parameter is required' }, { status: 400 });
    }

    // Check cache first (only if email is provided and not bypassing cache)
    if (email && !bypassCache) {
      const cacheKey = cacheKeys.taskActivity(email);
      const cachedData = await redisCache.get(cacheKey);
      
      if (cachedData) {
        console.log(`📦 Task activity cache hit for ${email}`);
        return NextResponse.json({
          success: true,
          groups: cachedData,
          cached: true
        });
      }
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
    
    // Get all task groups and tasks for the user (both owned and assigned)
    const query = `
       SELECT 
        tg.id as group_id,
        tg.title as group_title,
        tg.color as group_color,
        tg.position as group_position,
        tg.is_default,
        t.id as task_id,
        t.user_id as task_creator_id,
        t.title as task_title,
        t.description as task_description,
        t.priority as task_priority,
        tas.assignees as task_assignees,
        to_char((t.start_date AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS+08:00') as task_start_date,
        to_char((t.due_date   AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD"T"HH24:MI:SS.MS+08:00') as task_due_date,
        t.tags as task_tags,
        rel.task_relationships as task_relationships,
        cf.custom_fields as task_custom_fields,
        att.attachments as task_attachments,
        t.position as task_position,
        t.status as task_status,
        t.created_at as task_created_at,
        t.updated_at as task_updated_at,
        CASE WHEN t.user_id = $1 THEN true ELSE false END as is_owner
      FROM task_groups tg
      LEFT JOIN tasks t ON tg.id = t.group_id AND t.status = 'active' 
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
      LEFT JOIN LATERAL (
        SELECT COALESCE(array_agg(DISTINCT ta.user_id), '{}') AS assignees
        FROM task_assignees ta WHERE ta.task_id = t.id
      ) tas ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(DISTINCT jsonb_build_object('taskId', r.other_id::text, 'type', r.type)),
                 '[]'::jsonb
               ) AS task_relationships
        FROM (
          SELECT tr.related_task_id AS other_id, tr.type
          FROM task_relations tr WHERE tr.task_id = t.id
          UNION
          SELECT tr.task_id AS other_id, tr.type
          FROM task_relations tr WHERE tr.related_task_id = t.id
        ) r
      ) rel ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(
                   jsonb_build_object(
                     'id', scf.id,
                     'title', scf.title,
                     'description', scf.description,
                     'position', scf.position
                   ) ORDER BY scf.position ASC
                 ), '[]'::jsonb
               ) AS custom_fields
        FROM task_custom_fields scf WHERE scf.task_id = t.id
      ) cf ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
                 jsonb_agg(
                   jsonb_build_object(
                     'id', ta.id,
                     'name', ta.name,
                     'url', ta.url,
                     'path', ta.path,
                     'type', ta.type,
                     'size', ta.size,
                     'position', ta.position
                   ) ORDER BY ta.position ASC
                 ), '[]'::jsonb
               ) AS attachments
        FROM task_attachments ta WHERE ta.task_id = t.id
      ) att ON TRUE
      WHERE tg.created_by = $1 OR tg.is_default = true
      ORDER BY group_position, t.position
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
          creator_id: row.task_creator_id,
          is_owner: row.is_owner,
          title: row.task_title,
          description: row.task_description,
          priority: row.task_priority,
          assignees: row.task_assignees || [],
          start_date: row.task_start_date,
          due_date: row.task_due_date,
          task_relationships: row.task_relationships || [],
          task_custom_fields: row.task_custom_fields || [],
          attachments: row.task_attachments || [],
          tags: row.task_tags || [],
          position: row.task_position,
          status: row.task_status,
          created_at: row.task_created_at,
          updated_at: row.task_updated_at
        })
      }
    })
    
    await pool.end()
    
    const groupsData = Array.from(groups.values());
    
    // Store in cache if email is provided
    if (email) {
      const cacheKey = cacheKeys.taskActivity(email);
      await redisCache.set(cacheKey, groupsData, cacheTTL.taskActivity);
      console.log(`💾 Task activity cached for ${email}`);
    }
    
    return NextResponse.json({
      success: true,
      groups: groupsData
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
    
    // Helper function to invalidate cache
    const invalidateCache = async () => {
      if (email) {
        const cacheKey = cacheKeys.taskActivity(email);
        await redisCache.del(cacheKey);
        console.log(`🗑️ Task activity cache invalidated for ${email}`);
      }
    };

    switch (action) {
      case 'create_task':
        const { group_id, title, description, start_date: incomingStart, due_date: incomingDue } = data
        
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
            start_date, due_date, tags, position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `
        
        // Only set dates if provided; otherwise keep NULL
        const normalizedStart = incomingStart === undefined || incomingStart === null
          ? null
          : normalizeManilaTimestamp(incomingStart, false)
        const normalizedDue = incomingDue === undefined || incomingDue === null
          ? null
          : normalizeManilaTimestamp(incomingDue, true)
        const taskResult = await pool.query(createTaskQuery, [
          actualUserId,
          group_id,
          title || 'New Task',
          description || 'Task description',
          'normal',
          normalizedStart,
          normalizedDue,
          [],
          nextPosition
        ])
        
        const createdTask = taskResult.rows[0]
        
        // Automatically assign the creator as an assignee
        await pool.query(
          'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)',
          [createdTask.id, actualUserId]
        )
        
        await pool.end()
        
        // Invalidate cache after successful task creation
        await invalidateCache();
        
        return NextResponse.json({
          success: true,
          task: {
            ...createdTask,
            assignees: [actualUserId] // Include the creator in the response
          }
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
        
        // Invalidate cache after successful group creation
        await invalidateCache();
        
        return NextResponse.json({
          success: true,
          group: groupResult.rows[0]
        })
        
      case 'move_task':
        const { task_id, new_group_id, target_position } = data
        
        // Start a transaction
        const client = await pool.connect()
        
        try {
          await client.query('BEGIN')
          
          // Check if user has permission to move this task (creator OR assignee)
          const taskCheckQuery = `
            SELECT t.id, t.group_id, t.position, t.user_id as creator_id,
                   EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
            FROM tasks t
            WHERE t.id = $1 AND t.status = 'active'
          `
          const taskCheckResult = await client.query(taskCheckQuery, [task_id, actualUserId])
          
          if (taskCheckResult.rows.length === 0) {
            throw new Error('Task not found')
          }
          
          const taskPermission = taskCheckResult.rows[0]
          const isCreator = Number(taskPermission.creator_id) === Number(actualUserId)
          const isAssignee = taskPermission.is_assignee
          
          if (!isCreator && !isAssignee) {
            throw new Error('You do not have permission to move this task')
          }
          
          const currentTask = taskCheckResult.rows[0]
          
                     // Determine if this is a column change or just reordering
           const isColumnChange = currentTask.group_id !== parseInt(new_group_id)
           const isReordering = currentTask.group_id === parseInt(new_group_id) && currentTask.position !== target_position
           
           // Early return if no changes are needed
           if (!isColumnChange && !isReordering) {
             // Return early without making any database changes
             return NextResponse.json({
               success: true,
               task: currentTask,
               message: 'No changes needed'
             })
           }
          // If moving to a different group, re-index the source group first
          if (currentTask.group_id !== parseInt(new_group_id)) {
            const reindexSourceQuery = `
              UPDATE tasks 
              SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE group_id = $1 AND status = 'active' AND position > $2
            `
            await client.query(reindexSourceQuery, [currentTask.group_id, currentTask.position])
          }
          
          // If target_position is provided, we need to reorder tasks
          if (target_position !== undefined && target_position > 0) {
            // Check if we're moving within the same group
            if (currentTask.group_id === parseInt(new_group_id)) {
              // This is just reordering within the same column
              
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
              WHERE id = $3
              RETURNING *
            `
            
            const moveResult = await client.query(moveTaskQuery, [
              new_group_id,
              target_position,
              task_id
            ])
            
            await client.query('COMMIT')
            
            // Invalidate cache after successful task move
            await invalidateCache();
            
            return NextResponse.json({
              success: true,
              task: moveResult.rows[0]
            })
          } else {
            // If moving to a different group, re-index the source group first
            if (currentTask.group_id !== parseInt(new_group_id)) {
              const reindexSourceQuery = `
                UPDATE tasks 
                SET position = position - 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
                WHERE group_id = $1 AND status = 'active' AND position > $2
              `
              await client.query(reindexSourceQuery, [currentTask.group_id, currentTask.position])
            }
            
            // If no target position, just add to the end
            const movePositionQuery = `
              SELECT COALESCE(MAX(position), 0) + 1 as next_position
              FROM tasks
              WHERE group_id = $1 AND status = 'active'
            `
            const movePositionResult = await client.query(movePositionQuery, [new_group_id])
            const moveNextPosition = movePositionResult.rows[0].next_position
            
            // Move the task
            const moveTaskQuery = `
              UPDATE tasks 
              SET group_id = $1, position = $2, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
              WHERE id = $3
              RETURNING *
            `
            
            const moveResult = await client.query(moveTaskQuery, [
              new_group_id,
              moveNextPosition,
              task_id
            ])
            
            await client.query('COMMIT')
            
            // Invalidate cache after successful task move
            await invalidateCache();
            
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
          
          // Invalidate cache after successful group reorder
          await invalidateCache();
          
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
        
      case 'update_task':
        const { task_id: updateTaskId, updates } = data
        
        const updateClient = await pool.connect()
        
        try {
          await updateClient.query('BEGIN')
          
          // Check if user has permission to update this task (creator OR assignee)
          const permissionCheck = await updateClient.query(
            `SELECT t.id, t.user_id as creator_id,
                    EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
             FROM tasks t WHERE t.id = $1`,
            [updateTaskId, actualUserId]
          )
          
          if (permissionCheck.rows.length === 0) {
            throw new Error('Task not found')
          }
          
          const taskPermission = permissionCheck.rows[0]
          const isCreator = Number(taskPermission.creator_id) === Number(actualUserId)
          const isAssignee = taskPermission.is_assignee
          
          if (!isCreator && !isAssignee) {
            throw new Error('You do not have permission to update this task')
          }
          
          // Define which fields require creator permissions vs assignee permissions
          const creatorOnlyFields = ['title', 'assignees'] // Only title and assignees are creator-only
          const assigneeAllowedFields = ['relationships', 'group_id', 'description', 'priority', 'start_date', 'due_date', 'tags'] // Assignees can update most fields
          
          // Check if non-creator is trying to update creator-only fields
          if (!isCreator) {
            const attemptedFields = Object.keys(updates)
            const restrictedFields = attemptedFields.filter(field => 
              creatorOnlyFields.includes(field) && !assigneeAllowedFields.includes(field)
            )
            
            if (restrictedFields.length > 0) {
              throw new Error(`Only task creators can update these fields: ${restrictedFields.join(', ')}`)
            }
          }
          
          // Capture BEFORE state for precise diffing
          const beforeTaskRes = await updateClient.query(
            `SELECT t.id, t.title, t.description, t.priority, t.group_id, t.start_date, t.due_date, t.tags
             FROM tasks t WHERE t.id = $1`,
            [updateTaskId]
          )
          const beforeTask = beforeTaskRes.rows[0] || {}
          const beforeAssigneesRes = await updateClient.query(
            `SELECT COALESCE(array_agg(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL), '{}') AS assignees
             FROM task_assignees ta WHERE ta.task_id = $1`,
            [updateTaskId]
          )
          const beforeAssignees: number[] = beforeAssigneesRes.rows[0]?.assignees || []
          const beforeRelRes = await updateClient.query(
            `SELECT tr.related_task_id, t2.title AS related_title
             FROM task_relations tr JOIN tasks t2 ON t2.id = tr.related_task_id
             WHERE tr.task_id = $1`,
            [updateTaskId]
          )
          const beforeRelIds: number[] = beforeRelRes.rows.map((r: any) => Number(r.related_task_id))
          const beforeRelTitleById: Record<number, string> = Object.fromEntries(
            beforeRelRes.rows.map((r: any) => [Number(r.related_task_id), String(r.related_title || '')])
          )

          // Build dynamic update query
          const updateFields = []
          const updateValues = []
          let paramIndex = 1
          const changed: any = { actions: [] as any[] }
          
          // Only update fields that are provided
          if (updates.title !== undefined) {
            updateFields.push(`title = $${paramIndex}`)
            updateValues.push(updates.title)
            paramIndex++
            changed.title = updates.title
            if (beforeTask.title !== updates.title) changed.actions.push({ type: 'title_changed', from: beforeTask.title, to: updates.title })
          }
          
          if (updates.description !== undefined) {
            updateFields.push(`description = $${paramIndex}`)
            updateValues.push(updates.description)
            paramIndex++
            changed.description = true
            if (beforeTask.description !== updates.description) changed.actions.push({ type: 'description_changed' })
          }
          
          if (updates.priority !== undefined) {
            updateFields.push(`priority = $${paramIndex}`)
            updateValues.push(updates.priority)
            paramIndex++
            changed.priority = updates.priority
            if (beforeTask.priority !== updates.priority) changed.actions.push({ type: 'priority_changed', from: beforeTask.priority, to: updates.priority })
          }
          
          // Handle start_date (accept both start_date and startDate)
          {
            const startDateRaw = (updates as any).start_date ?? (updates as any).startDate
            if (startDateRaw !== undefined) {
              const normalizedStart = normalizeManilaTimestamp(startDateRaw, false)
              updateFields.push(`start_date = $${paramIndex}`)
              updateValues.push(normalizedStart)
              paramIndex++
              changed.start_date = normalizedStart
              if ((beforeTask.start_date || null) !== normalizedStart) changed.actions.push({ type: 'start_date_set', from: beforeTask.start_date || null, to: normalizedStart })
            }
          }
          
          // Handle due_date (accept both due_date and dueDate)
          {
            const dueRaw = (updates as any).due_date ?? (updates as any).dueDate
            if (dueRaw !== undefined) {
            // Normalize due_date to a full timestamp with Asia/Manila TZ
            let normalizedDue: string
            const due = dueRaw as any
            if (typeof due === 'string') {
              const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/
              if (dateOnlyRegex.test(due)) {
                normalizedDue = dateOnlyToManilaEndOfDayIso(due)
              } else if (/Z|[+\-]\d{2}:?\d{2}$/.test(due)) {
                // already has timezone info
                normalizedDue = due
              } else {
                // has time but no timezone, assume Manila
                normalizedDue = `${due.replace(/\s+/g, 'T')}${due.includes('T') ? '' : 'T'}+08:00`.replace('T+08:00', 'T00:00:00+08:00')
              }
            } else if (due instanceof Date) {
              normalizedDue = toManilaIso(due)
            } else {
              normalizedDue = toManilaIso(new Date())
            }
            updateFields.push(`due_date = $${paramIndex}`)
            updateValues.push(normalizedDue)
            paramIndex++
            changed.due_date = normalizedDue
            if ((beforeTask.due_date || null) !== normalizedDue) changed.actions.push({ type: 'due_date_set', from: beforeTask.due_date || null, to: normalizedDue })
            }
          }
          
          if (updates.tags !== undefined) {
            updateFields.push(`tags = $${paramIndex}`)
            updateValues.push(updates.tags)
            paramIndex++
            changed.tags = true
            try {
              const oldSet = new Set((beforeTask.tags as any[]) || [])
              const newSet = new Set((updates.tags as any[]) || [])
              const added = [...newSet].filter(x => !oldSet.has(x))
              const removed = [...oldSet].filter(x => !newSet.has(x))
              if (added.length) changed.actions.push({ type: 'tags_added', tags: added })
              if (removed.length) changed.actions.push({ type: 'tags_removed', tags: removed })
            } catch {}
          }
          
          if (updates.group_id !== undefined) {
            updateFields.push(`group_id = $${paramIndex}`)
            updateValues.push(updates.group_id)
            paramIndex++
            changed.group_id = updates.group_id
            if (beforeTask.group_id !== updates.group_id) {
              // Lookup group titles
              try {
                const gt = await updateClient.query(`SELECT id, title FROM task_groups WHERE id = ANY($1::int[])`, [[beforeTask.group_id, updates.group_id].filter(Boolean)])
                const map: Record<number, string> = Object.fromEntries(gt.rows.map((r:any)=>[Number(r.id), String(r.title || '')]))
                changed.actions.push({ type: 'status_changed', from: beforeTask.group_id, to: updates.group_id, fromLabel: map[beforeTask.group_id] || null, toLabel: map[updates.group_id] || null })
              } catch {
                changed.actions.push({ type: 'status_changed', from: beforeTask.group_id, to: updates.group_id })
              }
            }
          }
          
          // Always update the updated_at timestamp
          updateFields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Manila'`)
          
          if (updateFields.length === 0) {
            throw new Error('No fields to update')
          }
          
          // Add task_id and user_id to the values array
          updateValues.push(updateTaskId)
          
          const updateQuery = `
            UPDATE tasks 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *
          `
          
          const updateResult = await updateClient.query(updateQuery, updateValues)
          
          if (updateResult.rows.length === 0) {
            throw new Error('Task not found or not owned by user')
          }
          
          // If assignees provided, replace join rows
          if (Array.isArray((updates as any).assignees)) {
            await updateClient.query('DELETE FROM task_assignees WHERE task_id = $1', [updateTaskId])
            const assignees: number[] = (updates as any).assignees
            if (assignees.length > 0) {
              const values = assignees.map((uid, i) => `($1, $${i + 2})`).join(', ')
              await updateClient.query(`INSERT INTO task_assignees (task_id, user_id) VALUES ${values}`, [updateTaskId, ...assignees])
            }
            changed.assignees = assignees
            try {
              const oldSet = new Set(beforeAssignees)
              const newSet = new Set(assignees)
              const addedIds = [...newSet].filter(x => !oldSet.has(x))
              const removedIds = [...oldSet].filter(x => !newSet.has(x))
              const ids = [...addedIds, ...removedIds]
              let names: Record<number,string> = {}
              if (ids.length) {
                const q = await updateClient.query(
                  `SELECT u.id, COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email) AS name
                   FROM users u LEFT JOIN personal_info pi ON pi.user_id = u.id
                   WHERE u.id = ANY($1::int[])`,
                  [ids]
                )
                names = Object.fromEntries(q.rows.map((r:any)=>[Number(r.id), String(r.name || '')]))
              }
              if (addedIds.length) changed.actions.push({ type: 'assignees_added', assignees: addedIds.map(id=>({ id, name: names[id] })) })
              if (removedIds.length) changed.actions.push({ type: 'assignees_removed', assignees: removedIds.map(id=>({ id, name: names[id] })) })
            } catch {}
          }

          // Persist relationships if provided (array of { taskId, type })
          if (Array.isArray((updates as any).relationships)) {
            const rels = (updates as any).relationships as Array<{ taskId: string; type?: string }>
            await updateClient.query('DELETE FROM task_relations WHERE task_id = $1', [updateTaskId])
            if (rels.length > 0) {
              // Normalize and validate IDs (must be positive integers, not self)
              const normalized = rels
                .map(r => ({ otherId: parseInt(String(r.taskId), 10), type: r.type && r.type !== '' ? r.type : 'related_to' }))
                .filter(r => Number.isFinite(r.otherId) && r.otherId > 0 && r.otherId !== Number(updateTaskId))
              // De-duplicate by otherId
              const seen = new Set<number>()
              const unique = normalized.filter(r => (seen.has(r.otherId) ? false : (seen.add(r.otherId), true)))
              if (unique.length > 0) {
                const values: string[] = []
                const params: any[] = [updateTaskId]
                let idx = 2
                for (const r of unique) {
                  values.push(`($1, $${idx}, $${idx + 1})`)
                  params.push(r.otherId, r.type)
                  idx += 2
                }
                const insertSql = `INSERT INTO task_relations (task_id, related_task_id, type) VALUES ${values.join(', ')}`
                await updateClient.query(insertSql, params)
              }
            }
            changed.relationships = true
            try {
              const afterRel = await updateClient.query(
                `SELECT tr.related_task_id, t2.title AS related_title
                 FROM task_relations tr JOIN tasks t2 ON t2.id = tr.related_task_id
                 WHERE tr.task_id = $1`,
                [updateTaskId]
              )
              const afterIds: number[] = afterRel.rows.map((r:any)=>Number(r.related_task_id))
              const afterTitleById: Record<number,string> = Object.fromEntries(afterRel.rows.map((r:any)=>[Number(r.related_task_id), String(r.related_title || '')]))
              const oldSet = new Set(beforeRelIds)
              const newSet = new Set(afterIds)
              const added = [...newSet].filter(x=>!oldSet.has(x))
              const removed = [...oldSet].filter(x=>!newSet.has(x))
              if (added.length) changed.actions.push({ type: 'relationships_added', tasks: added.map(id=>({ id, title: afterTitleById[id] })) })
              if (removed.length) changed.actions.push({ type: 'relationships_removed', tasks: removed.map(id=>({ id, title: beforeRelTitleById[id] })) })
            } catch {}
          }

          await updateClient.query('COMMIT')
          
          const enriched = await updateClient.query(
            `SELECT t.*,
                    COALESCE(array_agg(DISTINCT ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL), '{}') AS assignees,
                    COALESCE(
                      jsonb_agg(DISTINCT jsonb_build_object('taskId', r.other_id::text, 'type', r.type)),
                      '[]'::jsonb
                    ) AS task_relationships,
                    COALESCE(
                      jsonb_agg(
                        jsonb_build_object('id', scf.id, 'title', scf.title, 'description', scf.description, 'position', scf.position)
                        ORDER BY scf.position ASC
                      ) FILTER (WHERE scf.id IS NOT NULL),
                      '[]'::jsonb
                    ) AS task_custom_fields
             FROM tasks t
             LEFT JOIN task_assignees ta ON ta.task_id = t.id
             LEFT JOIN LATERAL (
               SELECT tr.related_task_id AS other_id, tr.type FROM task_relations tr WHERE tr.task_id = t.id
               UNION
               SELECT tr.task_id AS other_id, tr.type FROM task_relations tr WHERE tr.related_task_id = t.id
             ) r ON TRUE
             LEFT JOIN task_custom_fields scf ON scf.task_id = t.id
             WHERE t.id = $1
             GROUP BY t.id`,
            [updateTaskId]
          )
          const taskRow = enriched.rows[0] || updateResult.rows[0]
          // Write activity history and notify via socket channel (pg_notify)
          try {
            const poolHist = getPool()
            const ev = await poolHist.query(
              `INSERT INTO task_activity_events (task_id, actor_user_id, action, details)
               VALUES ($1, $2, 'task_updated', $3)
               RETURNING id, task_id, actor_user_id, action, details, created_at`,
              [updateTaskId, actualUserId, JSON.stringify(changed)]
            )
            // Notify listeners for real-time UI updates
            await poolHist.query(
              `SELECT pg_notify('task_activity_events', $1)`,
              [JSON.stringify({ type: 'task_updated', event: ev.rows[0] })]
            )
            // Notify task updates with enriched task payload for board sync
            await poolHist.query(
              `SELECT pg_notify('task_updates', $1)`,
              [JSON.stringify({ task: taskRow })]
            )
            await poolHist.end()
          } catch (e) {
            console.error('Failed to persist/notify task_activity_events:', e)
          }
          
          // Invalidate cache after successful task update
          await invalidateCache();
          
          return NextResponse.json({
            success: true,
            task: taskRow
          })
          
        } catch (error) {
          console.error('Error updating task:', error)
          await updateClient.query('ROLLBACK')
          return NextResponse.json({ 
            error: 'Failed to update task', 
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        } finally {
          updateClient.release()
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