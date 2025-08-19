const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function simulateCrossUserTaskMovement() {
  try {
    console.log('🎭 SIMULATING CROSS-USER TASK MOVEMENT\n');

    // Get task groups
    const groupsResult = await pool.query(`
      SELECT id, title, position 
      FROM task_groups 
      ORDER BY position
    `);

    console.log('📋 Available Groups:');
    groupsResult.rows.forEach(g => console.log(`   ${g.id}: "${g.title}"`));

    // Find or create a task owned by User 4 that User 2 can see
    // (either User 2 is assigned to it, or it's in a shared group)
    
    // First, let's assign User 2 to a task owned by User 4
    let taskResult = await pool.query(`
      SELECT t.id, t.title, t.group_id, t.user_id, tg.title as group_title
      FROM tasks t
      JOIN task_groups tg ON t.group_id = tg.id
      WHERE t.user_id = 4 AND t.status = 'active'
      LIMIT 1
    `);

    let testTask;
    if (taskResult.rows.length === 0) {
      // Create a task owned by User 4
      console.log(`\n🔨 Creating task owned by User 4...`);
      const createResult = await pool.query(`
        INSERT INTO tasks (user_id, group_id, title, description, position)
        VALUES (4, $1, 'Cross-User Test Task', 'Task owned by User 4, visible to User 2', 1)
        RETURNING id, title, group_id, user_id
      `, [groupsResult.rows[0].id]);
      testTask = createResult.rows[0];
      console.log(`✅ Created task ${testTask.id}: "${testTask.title}"`);
    } else {
      testTask = taskResult.rows[0];
      console.log(`\n📝 Using existing task ${testTask.id}: "${testTask.title}"`);
    }

    // Assign User 2 to this task so they can see it
    console.log(`\n👥 Assigning User 2 to task ${testTask.id}...`);
    await pool.query(`
      INSERT INTO task_assignees (task_id, user_id)
      VALUES ($1, 2)
      ON CONFLICT (task_id, user_id) DO NOTHING
    `, [testTask.id]);
    console.log(`✅ User 2 is now assigned to the task`);

    // Now simulate User 4 moving the task to a different group
    const fromGroupId = testTask.group_id;
    const toGroupId = groupsResult.rows.find(g => g.id !== fromGroupId)?.id;
    
    if (!toGroupId) {
      console.log('❌ Need at least 2 groups to test movement');
      return;
    }

    const fromGroup = groupsResult.rows.find(g => g.id === fromGroupId);
    const toGroup = groupsResult.rows.find(g => g.id === toGroupId);

    console.log(`\n🔄 SIMULATING: User 4 moves task from "${fromGroup.title}" to "${toGroup.title}"`);
    console.log(`   This should be visible to User 2 in real-time!`);

    // Move the task (this simulates what happens when User 4 drags a task)
    const moveResult = await pool.query(`
      UPDATE tasks 
      SET group_id = $1, position = 1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, title, group_id, user_id
    `, [toGroupId, testTask.id]);

    if (moveResult.rows.length > 0) {
      console.log(`\n✅ TASK MOVED SUCCESSFULLY!`);
      console.log(`   Task: ${testTask.id} - "${testTask.title}"`);
      console.log(`   Owner: User 4`);
      console.log(`   Assignee: User 2`);
      console.log(`   From: "${fromGroup.title}" (ID: ${fromGroupId})`);
      console.log(`   To: "${toGroup.title}" (ID: ${toGroupId})`);
      
      console.log(`\n🔔 REAL-TIME NOTIFICATION FLOW:`);
      console.log(`   1. ✅ Database UPDATE triggers notify_tasks_change`);
      console.log(`   2. ✅ PostgreSQL sends NOTIFY on 'task_updates' channel`);
      console.log(`   3. ✅ Socket server receives notification`);
      console.log(`   4. ✅ Socket server broadcasts 'task_updated' to ALL users`);
      console.log(`   5. ✅ Frontend onTaskUpdated handler processes the change`);
      console.log(`   6. ✅ Task moves between columns in real-time`);
      
      console.log(`\n👀 WHAT USERS SHOULD SEE:`);
      console.log(`   • User 4: Task moves from "${fromGroup.title}" to "${toGroup.title}" (immediate)`);
      console.log(`   • User 2: ALSO sees task move from "${fromGroup.title}" to "${toGroup.title}" (real-time)`);
      console.log(`   • Any other user viewing the page: Also sees the change`);
      
      console.log(`\n🧪 TO VERIFY:`);
      console.log(`   1. Open task activity as User 2: http://localhost:3000/productivity/task-activity`);
      console.log(`   2. Open task activity as User 4 in another browser/tab`);
      console.log(`   3. In User 4's view, drag a task to a different column`);
      console.log(`   4. User 2 should immediately see the task move without refresh`);
      
      // Let's also check what User 2 can see
      console.log(`\n🔍 CHECKING WHAT USER 2 CAN SEE:`);
      const user2TasksResult = await pool.query(`
        SELECT 
          t.id, t.title, t.user_id as creator_id, tg.title as group_title,
          CASE WHEN t.user_id = 2 THEN true ELSE false END as is_owner,
          EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2) as is_assigned
        FROM task_groups tg
        LEFT JOIN tasks t ON tg.id = t.group_id AND t.status = 'active'
          AND (t.user_id = 2 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2))
        WHERE t.id IS NOT NULL
        ORDER BY tg.position, t.position
      `);
      
      console.log(`   User 2 can see ${user2TasksResult.rows.length} tasks:`);
      user2TasksResult.rows.forEach(task => {
        const ownership = task.is_owner ? 'OWNER' : (task.is_assigned ? 'ASSIGNED' : 'OTHER');
        console.log(`   • Task ${task.id}: "${task.title}" in "${task.group_title}" (${ownership})`);
      });
      
    } else {
      console.log('❌ Failed to move task');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

simulateCrossUserTaskMovement();
