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

// GET /api/tasks/types - Get all task types for the authenticated user
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
      // Ensure user has default types
      await client.query('SELECT create_default_task_types($1)', [user.id]);

      // Get all task types for the user, ensuring defaults exist
      const query = `
        SELECT id, type_name, type_color, type_order, is_default, description, created_at, updated_at
        FROM public.task_types 
        WHERE user_id = $1 
        ORDER BY type_order ASC, created_at ASC
      `;
      
      const result = await client.query(query, [user.id]);
      
      return NextResponse.json({ types: result.rows });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching task types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task types' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/types - Create a new task type
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
    const { type_name, description = '' } = body;

    // Generate a random color for the new task type
    const generateRandomColor = () => {
      const colors = [
        '#ef4444', // red
        '#f97316', // orange  
        '#f59e0b', // amber
        '#eab308', // yellow
        '#84cc16', // lime
        '#22c55e', // green
        '#10b981', // emerald
        '#14b8a6', // teal
        '#06b6d4', // cyan
        '#0ea5e9', // sky
        '#3b82f6', // blue
        '#6366f1', // indigo
        '#8b5cf6', // violet
        '#a855f7', // purple
        '#d946ef', // fuchsia
        '#ec4899', // pink
        '#f43f5e', // rose
      ];
      return colors[Math.floor(Math.random() * colors.length)];
    };
    
    const type_color = body.type_color || generateRandomColor();

    if (!type_name) {
      return NextResponse.json(
        { error: 'Type name is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      // Get the next order number
      const orderQuery = `
        SELECT COALESCE(MAX(type_order), 0) + 1 as next_order
        FROM task_types
        WHERE user_id = $1
      `;
      const orderResult = await client.query(orderQuery, [user.id]);
      const nextOrder = orderResult.rows[0].next_order;

      // Insert the new type
      const insertQuery = `
        INSERT INTO task_types (user_id, type_name, type_color, type_order, is_default, description)
        VALUES ($1, $2, $3, $4, false, $5)
        RETURNING id, type_name, type_color, type_order, is_default, description
      `;
      
      const result = await client.query(insertQuery, [
        user.id,
        type_name,
        type_color,
        nextOrder,
        description
      ]);

      return NextResponse.json({ 
        message: 'Task type created successfully',
        type: result.rows[0]
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating task type:', error);
    
    if ((error as any).code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Type name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create task type' },
      { status: 500 }
    );
  }
} 

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const typeId = url.searchParams.get('id');

    if (!typeId) {
      return NextResponse.json({ error: 'Type ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Check if the type exists and belongs to the user
      const checkQuery = `
        SELECT id, type_name, is_default 
        FROM public.task_types 
        WHERE id = $1 AND user_id = $2
      `;
      const checkResult = await client.query(checkQuery, [typeId, user.id]);

      if (checkResult.rows.length === 0) {
        return NextResponse.json({ error: 'Task type not found' }, { status: 404 });
      }

      const taskType = checkResult.rows[0];

      // Prevent deletion of default types
      if (taskType.is_default) {
        return NextResponse.json(
          { error: 'Cannot delete default task type' }, 
          { status: 403 }
        );
      }

      // Get the first available task type (preferably a default one) to reassign tasks to
      const fallbackTypeQuery = `
        SELECT id 
        FROM public.task_types 
        WHERE user_id = $1 AND id != $2 
        ORDER BY is_default DESC, type_order ASC, created_at ASC 
        LIMIT 1
      `;
      const fallbackResult = await client.query(fallbackTypeQuery, [user.id, typeId]);
      
      if (fallbackResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Cannot delete task type - no alternative task type available' }, 
          { status: 409 }
        );
      }

      const fallbackTypeId = fallbackResult.rows[0].id;

      // Check if any tasks are currently using this type and count them
      const taskCheckQuery = `
        SELECT COUNT(*) as task_count 
        FROM public.tasks 
        WHERE task_type_id = $1 AND user_id = $2
      `;
      const taskCheckResult = await client.query(taskCheckQuery, [typeId, user.id]);
      const taskCount = parseInt(taskCheckResult.rows[0].task_count);

      let reassignedCount = 0;
      
      // If tasks are using this type, reassign them to the fallback type
      if (taskCount > 0) {
        const reassignQuery = `
          UPDATE public.tasks 
          SET task_type_id = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE task_type_id = $2 AND user_id = $3
        `;
        const reassignResult = await client.query(reassignQuery, [fallbackTypeId, typeId, user.id]);
        reassignedCount = reassignResult.rowCount || 0;
      }

      // Delete the task type
      const deleteQuery = `
        DELETE FROM public.task_types 
        WHERE id = $1 AND user_id = $2
      `;
      await client.query(deleteQuery, [typeId, user.id]);

      const message = reassignedCount > 0 
        ? `Task type '${taskType.type_name}' deleted successfully. ${reassignedCount} task(s) were automatically reassigned to the default task type.`
        : `Task type '${taskType.type_name}' deleted successfully`;

      return NextResponse.json(
        { 
          message,
          reassignedCount 
        }, 
        { status: 200 }
      );

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Delete task type error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task type' }, 
      { status: 500 }
    );
  }
} 