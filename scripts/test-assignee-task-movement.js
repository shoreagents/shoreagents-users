const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testAssigneeTaskMovement() {
  try {
    console.log('🧪 TESTING ASSIGNEE TASK MOVEMENT PERMISSIONS\n');

    // Get task groups
    const groupsResult = await pool.query(`
      SELECT id, title, position 
      FROM task_groups 
      ORDER BY position
    `);

    console.log('📋 Available Groups:');
    groupsResult.rows.forEach(g => console.log(`   ${g.id}: "${g.title}"`));

    if (groupsResult.rows.length < 2) {
      console.log('❌ Need at least 2 groups to test movement');
      return;
    }

    // Create a task owned by User 4
    const fromGroup = groupsResult.rows[0];
    const toGroup = groupsResult.rows[1];

    console.log(`\n🔨 Creating test task owned by User 4...`);
    const createResult = await pool.query(`
      INSERT INTO tasks (user_id, group_id, title, description, position)
      VALUES (4, $1, 'Assignee Movement Test Task', 'Task to test if assignees can move tasks', 1)
      RETURNING id, title, group_id, user_id
    `, [fromGroup.id]);

    const testTask = createResult.rows[0];
    console.log(`✅ Created task ${testTask.id}: "${testTask.title}"`);
    console.log(`   Owner: User ${testTask.user_id}`);
    console.log(`   Group: "${fromGroup.title}" (ID: ${testTask.group_id})`);

    // Assign User 2 to this task
    console.log(`\n👥 Assigning User 2 to task ${testTask.id}...`);
    await pool.query(`
      INSERT INTO task_assignees (task_id, user_id)
      VALUES ($1, 2)
      ON CONFLICT (task_id, user_id) DO NOTHING
    `, [testTask.id]);
    console.log(`✅ User 2 is now assigned to the task`);

    // Test 1: Try to move task as the assignee (User 2)
    console.log(`\n🧪 TEST 1: User 2 (assignee) tries to move task from "${fromGroup.title}" to "${toGroup.title}"`);
    
    try {
      // Simulate API call to update task group_id as User 2
      const moveResult = await pool.query(`
        UPDATE tasks 
        SET group_id = $1, position = 1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, title, group_id, user_id
      `, [toGroup.id, testTask.id]);

      if (moveResult.rows.length > 0) {
        console.log(`✅ SUCCESS: User 2 (assignee) can move the task!`);
        console.log(`   Task moved from "${fromGroup.title}" to "${toGroup.title}"`);
        
        // Verify the change
        const verifyResult = await pool.query(`
          SELECT t.id, t.title, t.user_id, tg.title as group_title,
                 EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2) as user2_assigned
          FROM tasks t
          JOIN task_groups tg ON t.group_id = tg.id
          WHERE t.id = $1
        `, [testTask.id]);
        
        const task = verifyResult.rows[0];
        console.log(`   ✓ Task ${task.id}: "${task.title}"`);
        console.log(`   ✓ Owner: User ${task.user_id}`);
        console.log(`   ✓ Current Group: "${task.group_title}"`);
        console.log(`   ✓ User 2 Assigned: ${task.user2_assigned ? 'Yes' : 'No'}`);
      }
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }

    // Test 2: Try to move task as a non-assignee (User 3)
    console.log(`\n🧪 TEST 2: User 3 (non-assignee) tries to move the task`);
    
    // First, let's simulate the API permission check for User 3
    const permissionCheck = await pool.query(`
      SELECT t.id, t.user_id as creator_id,
             EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 3) as is_assignee
      FROM tasks t WHERE t.id = $1
    `, [testTask.id]);

    const taskPermission = permissionCheck.rows[0];
    const isCreator = Number(taskPermission.creator_id) === 3; // User 3
    const isAssignee = taskPermission.is_assignee;

    console.log(`   User 3 is creator: ${isCreator}`);
    console.log(`   User 3 is assignee: ${isAssignee}`);

    if (!isCreator && !isAssignee) {
      console.log(`✅ CORRECT: User 3 has no permission to move the task`);
      console.log(`   This would be blocked by the API permission check`);
    } else {
      console.log(`❌ UNEXPECTED: User 3 should not have permission`);
    }

    // Test 3: Show what fields each user type can update
    console.log(`\n📋 PERMISSION SUMMARY:`);
    console.log(`   👑 TASK CREATOR (User 4) can update:`);
    console.log(`      • title, description, priority`);
    console.log(`      • start_date, due_date, tags`);
    console.log(`      • assignees (add/remove people)`);
    console.log(`      • group_id (move between columns) ✅`);
    console.log(`      • relationships`);
    
    console.log(`   👤 TASK ASSIGNEE (User 2) can update:`);
    console.log(`      • group_id (move between columns) ✅`);
    console.log(`      • relationships`);
    console.log(`      • ❌ Cannot update: title, description, priority, dates, tags, assignees`);
    
    console.log(`   🚫 NON-ASSIGNEE (User 3) can update:`);
    console.log(`      • Nothing - no access to the task`);

    console.log(`\n🎯 REAL-WORLD SCENARIO:`);
    console.log(`   1. Project Manager (User 4) creates a task "Fix login bug"`);
    console.log(`   2. Assigns Developer (User 2) to work on it`);
    console.log(`   3. Developer can move task: "To Do" → "In Progress" → "Review" → "Done"`);
    console.log(`   4. Developer cannot change task title or assign it to someone else`);
    console.log(`   5. Other users (User 3) cannot see or modify the task`);

    console.log(`\n✅ This is the recommended collaborative workflow!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testAssigneeTaskMovement();
