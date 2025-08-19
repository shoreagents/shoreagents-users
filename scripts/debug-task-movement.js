const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugTaskMovement() {
  try {
    console.log('🔍 DEBUGGING TASK MOVEMENT ISSUE\n');

    // Find a task that User 2 is assigned to but doesn't own
    const assignedTasksResult = await pool.query(`
      SELECT 
        t.id, t.title, t.group_id, t.user_id as creator_id, tg.title as group_title,
        EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2) as user2_assigned
      FROM tasks t
      JOIN task_groups tg ON t.group_id = tg.id
      WHERE t.status = 'active'
        AND t.user_id != 2  -- Not owned by User 2
        AND EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2)  -- But assigned to User 2
      LIMIT 1
    `);

    if (assignedTasksResult.rows.length === 0) {
      console.log('❌ No assigned tasks found for User 2. Let me create one...');
      
      // Get available groups
      const groupsResult = await pool.query(`
        SELECT id, title FROM task_groups ORDER BY position LIMIT 2
      `);
      
      if (groupsResult.rows.length < 2) {
        console.log('❌ Need at least 2 groups to test movement');
        return;
      }

      // Create a task owned by User 4
      const createResult = await pool.query(`
        INSERT INTO tasks (user_id, group_id, title, description, position)
        VALUES (4, $1, 'Debug Movement Test', 'Task to debug movement issue', 1)
        RETURNING id, title, group_id, user_id
      `, [groupsResult.rows[0].id]);

      const newTask = createResult.rows[0];
      console.log(`✅ Created task ${newTask.id}: "${newTask.title}"`);

      // Assign User 2 to this task
      await pool.query(`
        INSERT INTO task_assignees (task_id, user_id)
        VALUES ($1, 2)
      `, [newTask.id]);
      console.log(`✅ Assigned User 2 to task ${newTask.id}`);

      // Use this task for testing
      assignedTasksResult.rows[0] = {
        id: newTask.id,
        title: newTask.title,
        group_id: newTask.group_id,
        creator_id: newTask.user_id,
        group_title: groupsResult.rows[0].title,
        user2_assigned: true
      };
    }

    const testTask = assignedTasksResult.rows[0];
    console.log(`\n📝 Testing with task:`);
    console.log(`   ID: ${testTask.id}`);
    console.log(`   Title: "${testTask.title}"`);
    console.log(`   Creator: User ${testTask.creator_id}`);
    console.log(`   Current Group: "${testTask.group_title}" (ID: ${testTask.group_id})`);
    console.log(`   User 2 Assigned: ${testTask.user2_assigned}`);

    // Get target group (different from current)
    const targetGroupResult = await pool.query(`
      SELECT id, title FROM task_groups 
      WHERE id != $1 
      ORDER BY position 
      LIMIT 1
    `, [testTask.group_id]);

    if (targetGroupResult.rows.length === 0) {
      console.log('❌ No target group available for movement');
      return;
    }

    const targetGroup = targetGroupResult.rows[0];
    console.log(`   Target Group: "${targetGroup.title}" (ID: ${targetGroup.id})`);

    // Test the permission check that the API uses
    console.log(`\n🔍 TESTING PERMISSION CHECK (as User 2):`);
    const permissionResult = await pool.query(`
      SELECT t.id, t.group_id, t.position, t.user_id as creator_id,
             EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
      FROM tasks t
      WHERE t.id = $1 AND t.status = 'active'
    `, [testTask.id, 2]); // User 2

    if (permissionResult.rows.length === 0) {
      console.log('❌ PERMISSION CHECK FAILED: Task not found');
      return;
    }

    const permission = permissionResult.rows[0];
    const isCreator = Number(permission.creator_id) === 2;
    const isAssignee = permission.is_assignee;

    console.log(`   Task found: ✅`);
    console.log(`   User 2 is creator: ${isCreator}`);
    console.log(`   User 2 is assignee: ${isAssignee}`);
    console.log(`   Permission granted: ${isCreator || isAssignee ? '✅' : '❌'}`);

    if (!isCreator && !isAssignee) {
      console.log('❌ User 2 has no permission to move this task');
      return;
    }

    // Test the actual move operation
    console.log(`\n🔄 TESTING MOVE OPERATION:`);
    console.log(`   Moving task ${testTask.id} from group ${testTask.group_id} to group ${targetGroup.id}`);

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Use the same logic as the API
        const moveResult = await client.query(`
          UPDATE tasks 
          SET group_id = $1, position = 1, updated_at = NOW() AT TIME ZONE 'Asia/Manila'
          WHERE id = $2 AND status = 'active'
          RETURNING id, title, group_id, user_id
        `, [targetGroup.id, testTask.id]);

        if (moveResult.rows.length > 0) {
          await client.query('COMMIT');
          const movedTask = moveResult.rows[0];
          console.log(`✅ MOVE SUCCESSFUL!`);
          console.log(`   Task ${movedTask.id} moved to group ${movedTask.group_id}`);
          
          // Verify the task is still visible to User 2
          const visibilityCheck = await pool.query(`
            SELECT t.id, t.title, tg.title as group_title
            FROM tasks t
            JOIN task_groups tg ON t.group_id = tg.id
            WHERE t.id = $1 
              AND t.status = 'active'
              AND (t.user_id = 2 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2))
          `, [testTask.id]);
          
          if (visibilityCheck.rows.length > 0) {
            console.log(`✅ Task is still visible to User 2 after move`);
            console.log(`   Now in group: "${visibilityCheck.rows[0].group_title}"`);
          } else {
            console.log(`❌ Task became invisible to User 2 after move!`);
            console.log(`   This suggests a visibility/filtering issue`);
          }
          
        } else {
          await client.query('ROLLBACK');
          console.log(`❌ MOVE FAILED: No rows updated`);
        }
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.log(`❌ MOVE ERROR: ${error.message}`);
    }

    console.log(`\n💡 NEXT STEPS:`);
    console.log(`   1. Check if the API move_task action is working correctly`);
    console.log(`   2. Check if the frontend is handling the response properly`);
    console.log(`   3. Check if the task visibility query is correct`);
    console.log(`   4. Check browser console for JavaScript errors`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugTaskMovement();
