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

// GET /api/tasks - Get all tasks for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const client = await pool.connect();
    
    try {
      // Get tasks with status and type information
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
        WHERE t.user_id = $1
        GROUP BY t.id, ts.status_name, ts.status_color, ts.is_completed, tt.type_name, tt.type_color
        ORDER BY t.created_at DESC
      `;
      
      const result = await client.query(query, [user.id]);
      
      // Format timestamps for frontend display and map database fields to frontend format
      const tasks = result.rows.map(row => ({
        id: row.task_id, // Use task_id as the main id for frontend
        task_id: row.task_id,
        taskName: row.task_name,
        status: row.status_name,
        status_name: row.status_name,
        status_color: row.status_color,
        is_completed: row.is_completed,
        assignee: row.assignee,
        priority: row.priority,
        taskType: row.type_name,
        type_name: row.type_name,
        type_color: row.type_color,
        description: row.description,
        dueDate: row.due_date,
        due_date: row.due_date,
        createdBy: row.created_by,
        created_by: row.created_by,
        lastEditedBy: row.last_edited_by,
        last_edited_by: row.last_edited_by,
        attachedFiles: row.files || [],
        files: row.files || [],
        createdTime: new Date(row.created_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        created_at: new Date(row.created_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        lastEditedTime: new Date(row.updated_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        updated_at: new Date(row.updated_at).toLocaleString('en-US', {
          timeZone: 'Asia/Manila',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }),
        user_id: row.user_id
      }));

      return NextResponse.json({ tasks });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    
    if (!user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('API received body:', body);
    
    const {
      task_id,
      task_name,
      assignee,
      status_name = 'Not Started',
      priority = 'medium',
      type_name = 'Document',
      description,
      due_date,
      created_by,
      files = []
    } = body;

    console.log('Extracted fields:', {
      task_id, task_name, assignee, status_name, priority, 
      type_name, description, due_date, created_by
    });

    // Validate required fields
    if (!task_id || !task_name || !assignee || !created_by) {
      console.error('Validation failed - missing required fields:', {
        task_id: !!task_id, task_name: !!task_name, 
        assignee: !!assignee, created_by: !!created_by
      });
      return NextResponse.json(
        { error: 'Missing required fields: task_id, task_name, assignee, created_by' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Insert the task
      const insertTaskQuery = `
        INSERT INTO tasks (
          task_id, user_id, task_name, assignee, status_id, 
          priority, task_type_id, description, due_date,
          created_by, last_edited_by, created_at, updated_at
        ) 
        VALUES (
          $1, $2, $3, $4, 
          (SELECT get_task_status_id($2, $5)),
          $6::task_priority_enum, 
          (SELECT get_task_type_id($2, $7)), 
          $8, $9, $10, $11, 
          NOW() AT TIME ZONE 'Asia/Manila', 
          NOW() AT TIME ZONE 'Asia/Manila'
        )
        RETURNING id
      `;
      
      const taskResult = await client.query(insertTaskQuery, [
        task_id,
        user.id,
        task_name,
        assignee,
        status_name,
        priority,
        type_name,
        description,
        due_date || null,
        created_by,
        created_by // last_edited_by starts as created_by
      ]);

      const newTaskId = taskResult.rows[0].id;

      // Insert files if any
      if (files && files.length > 0) {
        for (const file of files) {
          const insertFileQuery = `
            INSERT INTO task_files (task_id, file_name, file_size)
            VALUES ($1, $2, $3)
          `;
          await client.query(insertFileQuery, [
            newTaskId,
            file.name,
            file.size || null
          ]);
        }
      }

      await client.query('COMMIT');

      return NextResponse.json({ 
        message: 'Task created successfully',
        task_id: task_id,
        id: newTaskId
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', {
      message: (error as any).message,
      code: (error as any).code,
      detail: (error as any).detail,
      stack: (error as any).stack
    });
    
    if ((error as any).code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Task ID already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create task', details: (error as any).message },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Update a task (this endpoint will be in the [id] route file) 