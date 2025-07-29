import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Helper function to get user from request
async function getUserFromRequest(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('shoreagents-auth');
    if (!authCookie) {
      return null;
    }

    const authData = JSON.parse(authCookie.value);
    return {
      id: authData.user?.id,
      email: authData.user?.email
    };
  } catch (error) {
    console.error('Error parsing auth cookie:', error);
    return null;
  }
}

// GET /api/tasks/[id] - Get a specific task by task_id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    const client = await pool.connect();
    
    try {
      // Get task with status, type, and files information
      const query = `
        SELECT 
          t.id,
          t.task_id,
          t.user_id,
          t.task_name,
          t.assignee,
          t.priority,
          t.description,
          t.due_date,
          t.created_by,
          t.last_edited_by,
          t.created_at,
          t.updated_at,
          ts.status_name,
          ts.status_color,
          ts.is_completed,
          tt.type_name,
          tt.type_color,
          array_agg(DISTINCT tf.file_name) FILTER (WHERE tf.file_name IS NOT NULL) as files
        FROM tasks t
        JOIN task_statuses ts ON t.status_id = ts.id
        JOIN task_types tt ON t.task_type_id = tt.id
        LEFT JOIN task_files tf ON t.id = tf.task_id
        WHERE t.task_id = $1 AND t.user_id = $2
        GROUP BY t.id, ts.status_name, ts.status_color, ts.is_completed, tt.type_name, tt.type_color
      `;
      
      const result = await client.query(query, [taskId, user.id]);
      
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        );
      }

      const task = result.rows[0];
      
      // Format timestamps for frontend display and map database fields to frontend format
      const formattedTask = {
        id: task.task_id, // Use task_id as the main id for frontend
        task_id: task.task_id,
        taskName: task.task_name,
        status: task.status_name,
        status_name: task.status_name,
        status_color: task.status_color,
        is_completed: task.is_completed,
        assignee: task.assignee,
        priority: task.priority,
        taskType: task.type_name,
        type_name: task.type_name,
        type_color: task.type_color,
        description: task.description,
        dueDate: task.due_date,
        due_date: task.due_date,
        createdBy: task.created_by,
        created_by: task.created_by,
        lastEditedBy: task.last_edited_by,
        last_edited_by: task.last_edited_by,
        attachedFiles: task.files || [],
        files: task.files || [],
        createdTime: new Date(task.created_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        created_at: new Date(task.created_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        lastEditedTime: new Date(task.updated_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        updated_at: new Date(task.updated_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        user_id: task.user_id
      };

      return NextResponse.json({ task: formattedTask });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Update a specific task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;
    const body = await request.json();

    const client = await pool.connect();
    
    try {
      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramCount = 1;

      if (body.task_name !== undefined) {
        updateFields.push(`task_name = $${paramCount++}`);
        updateValues.push(body.task_name);
      }
      if (body.assignee !== undefined) {
        updateFields.push(`assignee = $${paramCount++}`);
        updateValues.push(body.assignee);
      }
      if (body.status_name !== undefined) {
        updateFields.push(`status_id = (SELECT get_task_status_id($${paramCount}, $${paramCount + 1}))`);
        updateValues.push(user.id, body.status_name);
        paramCount += 2;
      }
      if (body.priority !== undefined) {
        updateFields.push(`priority = $${paramCount++}::task_priority_enum`);
        updateValues.push(body.priority);
      }
      if (body.type_name !== undefined) {
        updateFields.push(`task_type_id = (SELECT get_task_type_id($${paramCount}, $${paramCount + 1}))`);
        updateValues.push(user.id, body.type_name);
        paramCount += 2;
      }
      if (body.description !== undefined) {
        updateFields.push(`description = $${paramCount++}`);
        updateValues.push(body.description);
      }
      if (body.due_date !== undefined) {
        updateFields.push(`due_date = $${paramCount++}`);
        updateValues.push(body.due_date);
      }
      if (body.last_edited_by !== undefined) {
        updateFields.push(`last_edited_by = $${paramCount++}`);
        updateValues.push(body.last_edited_by);
      }

      // Always update the updated_at timestamp
      updateFields.push(`updated_at = NOW() AT TIME ZONE 'Asia/Manila'`);

      if (updateFields.length === 1) { // Only the updated_at field
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      // Add WHERE conditions
      updateValues.push(taskId, user.id);
      const whereClause = `WHERE task_id = $${paramCount} AND user_id = $${paramCount + 1}`;

      const updateQuery = `
        UPDATE tasks 
        SET ${updateFields.join(', ')}
        ${whereClause}
        RETURNING id
      `;

      const result = await client.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Task not found or access denied' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        message: 'Task updated successfully',
        task_id: taskId
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete a specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: taskId } = await params;

    const client = await pool.connect();
    
    try {
      // Delete the task (files will be deleted automatically due to CASCADE)
      const deleteQuery = `
        DELETE FROM tasks 
        WHERE task_id = $1 AND user_id = $2
        RETURNING id
      `;
      
      const result = await client.query(deleteQuery, [taskId, user.id]);

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Task not found or access denied' },
          { status: 404 }
        );
      }

      return NextResponse.json({ 
        message: 'Task deleted successfully',
        task_id: taskId
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
} 