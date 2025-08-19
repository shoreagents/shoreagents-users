const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRealtimeTaskMovement() {
  try {
    console.log('🧪 TESTING REAL-TIME TASK MOVEMENT BETWEEN USERS\n');

    // First, let's see what task groups exist
    const groupsResult = await pool.query(`
      SELECT id, title, position, created_by
      FROM task_groups 
      ORDER BY position
    `);

    console.log('📋 Available Task Groups:');
    groupsResult.rows.forEach(group => {
      console.log(`   ${group.id}: "${group.title}" (position: ${group.position}, created_by: ${group.created_by})`);
    });

    if (groupsResult.rows.length < 2) {
      console.log('❌ Need at least 2 task groups to test movement');
      return;
    }

    const fromGroup = groupsResult.rows[0];
    const toGroup = groupsResult.rows[1];

    // Find a task in the first group, or create one if none exists
    let taskResult = await pool.query(`
      SELECT t.id, t.title, t.group_id, t.user_id, tg.title as group_title
      FROM tasks t
      JOIN task_groups tg ON t.group_id = tg.id
      WHERE t.group_id = $1 AND t.status = 'active'
      LIMIT 1
    `, [fromGroup.id]);

    let testTask;
    if (taskResult.rows.length === 0) {
      // Create a test task
      console.log(`\n🔨 Creating test task in group "${fromGroup.title}"...`);
      const createResult = await pool.query(`
        INSERT INTO tasks (user_id, group_id, title, description, position)
        VALUES (4, $1, 'Test Task for Real-time Movement', 'This task will be moved between groups to test real-time updates', 1)
        RETURNING id, title, group_id, user_id
      `, [fromGroup.id]);
      testTask = createResult.rows[0];
      console.log(`✅ Created task: ${testTask.id} - "${testTask.title}"`);
    } else {
      testTask = taskResult.rows[0];
      console.log(`\n📝 Using existing task: ${testTask.id} - "${testTask.title}" in group "${testTask.group_title}"`);
    }

    console.log(`\n🔄 Moving task ${testTask.id} from group "${fromGroup.title}" to group "${toGroup.title}"...`);
    
    // Move the task to a different group
    const moveResult = await pool.query(`
      UPDATE tasks 
      SET group_id = $1, position = 1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, title, group_id, user_id
    `, [toGroup.id, testTask.id]);

    if (moveResult.rows.length > 0) {
      const movedTask = moveResult.rows[0];
      console.log(`✅ Task moved successfully!`);
      console.log(`   Task ID: ${movedTask.id}`);
      console.log(`   Title: "${movedTask.title}"`);
      console.log(`   New Group ID: ${movedTask.group_id} ("${toGroup.title}")`);
      console.log(`   Task Owner: User ${movedTask.user_id}`);
      
      console.log(`\n🔔 This should trigger a real-time notification:`);
      console.log(`   • Database trigger: notify_tasks_change`);
      console.log(`   • PostgreSQL NOTIFY: task_updates channel`);
      console.log(`   • Socket.IO broadcast: task_updated event to ALL users`);
      console.log(`   • Frontend update: onTaskUpdated handler should move task between columns`);
      
      console.log(`\n👥 Expected behavior:`);
      console.log(`   • User 4 (task owner): Should see task move in real-time`);
      console.log(`   • User 2 (other user): Should ALSO see task move in real-time`);
      console.log(`   • Any user viewing task activity: Should see the change immediately`);
      
      console.log(`\n🧪 To test:`);
      console.log(`   1. Open task activity page as User 2`);
      console.log(`   2. Open task activity page as User 4 in another browser/tab`);
      console.log(`   3. Move a task in User 4's view`);
      console.log(`   4. User 2 should see the task move in real-time without refresh`);
      
    } else {
      console.log('❌ Failed to move task');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRealtimeTaskMovement();
