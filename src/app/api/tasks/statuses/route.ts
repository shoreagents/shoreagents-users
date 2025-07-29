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

// GET /api/tasks/statuses - Get all task statuses for the authenticated user
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
      // Ensure user has default statuses
      await client.query('SELECT create_default_task_statuses($1)', [user.id]);

      // Get all statuses for the user, ensuring defaults exist
      const query = `
        SELECT id, status_name, status_color, status_order, is_default, is_completed, description, created_at, updated_at
        FROM public.task_statuses 
        WHERE user_id = $1 
        ORDER BY status_order ASC, created_at ASC
      `;
      
      const result = await client.query(query, [user.id]);
      
      return NextResponse.json({ statuses: result.rows });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error fetching task statuses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task statuses' },
      { status: 500 }
    );
  }
}

// POST /api/tasks/statuses - Create a new task status
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
    const { status_name, is_completed = false, description = '' } = body;
    
    // Generate a random color for the new status
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
    
    const status_color = body.status_color || generateRandomColor();

    if (!status_name) {
      return NextResponse.json(
        { error: 'Status name is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    
    try {
      // Get the next order number
      const orderQuery = `
        SELECT COALESCE(MAX(status_order), 0) + 1 as next_order
        FROM task_statuses
        WHERE user_id = $1
      `;
      const orderResult = await client.query(orderQuery, [user.id]);
      const nextOrder = orderResult.rows[0].next_order;

      // Insert the new status
      const insertQuery = `
        INSERT INTO task_statuses (user_id, status_name, status_color, status_order, is_default, is_completed, description)
        VALUES ($1, $2, $3, $4, false, $5, $6)
        RETURNING id, status_name, status_color, status_order, is_default, is_completed, description
      `;
      
      const result = await client.query(insertQuery, [
        user.id,
        status_name,
        status_color,
        nextOrder,
        is_completed,
        description
      ]);

      return NextResponse.json({ 
        message: 'Status created successfully',
        status: result.rows[0]
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating task status:', error);
    
    if ((error as any).code === '23505') { // Unique constraint violation
      return NextResponse.json(
        { error: 'Status name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create task status' },
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
    const statusId = url.searchParams.get('id');

    if (!statusId) {
      return NextResponse.json({ error: 'Status ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      // Check if the status exists and belongs to the user
      const checkQuery = `
        SELECT id, status_name, is_default 
        FROM public.task_statuses 
        WHERE id = $1 AND user_id = $2
      `;
      const checkResult = await client.query(checkQuery, [statusId, user.id]);

      if (checkResult.rows.length === 0) {
        return NextResponse.json({ error: 'Status not found' }, { status: 404 });
      }

      const status = checkResult.rows[0];

      // Prevent deletion of default statuses
      if (status.is_default) {
        return NextResponse.json(
          { error: 'Cannot delete default status' }, 
          { status: 403 }
        );
      }

      // Get the first available status (preferably a default one) to reassign tasks to
      const fallbackStatusQuery = `
        SELECT id 
        FROM public.task_statuses 
        WHERE user_id = $1 AND id != $2 
        ORDER BY is_default DESC, status_order ASC, created_at ASC 
        LIMIT 1
      `;
      const fallbackResult = await client.query(fallbackStatusQuery, [user.id, statusId]);
      
      if (fallbackResult.rows.length === 0) {
        return NextResponse.json(
          { error: 'Cannot delete status - no alternative status available' }, 
          { status: 409 }
        );
      }

      const fallbackStatusId = fallbackResult.rows[0].id;

      // Check if any tasks are currently using this status and count them
      const taskCheckQuery = `
        SELECT COUNT(*) as task_count 
        FROM public.tasks 
        WHERE status_id = $1 AND user_id = $2
      `;
      const taskCheckResult = await client.query(taskCheckQuery, [statusId, user.id]);
      const taskCount = parseInt(taskCheckResult.rows[0].task_count);

      let reassignedCount = 0;
      
      // If tasks are using this status, reassign them to the fallback status
      if (taskCount > 0) {
        const reassignQuery = `
          UPDATE public.tasks 
          SET status_id = $1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE status_id = $2 AND user_id = $3
        `;
        const reassignResult = await client.query(reassignQuery, [fallbackStatusId, statusId, user.id]);
        reassignedCount = reassignResult.rowCount || 0;
      }

      // Delete the status
      const deleteQuery = `
        DELETE FROM public.task_statuses 
        WHERE id = $1 AND user_id = $2
      `;
      await client.query(deleteQuery, [statusId, user.id]);

      const message = reassignedCount > 0 
        ? `Status '${status.status_name}' deleted successfully. ${reassignedCount} task(s) were automatically reassigned to the default status.`
        : `Status '${status.status_name}' deleted successfully`;

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
    console.error('Delete status error:', error);
    return NextResponse.json(
      { error: 'Failed to delete status' }, 
      { status: 500 }
    );
  }
} 