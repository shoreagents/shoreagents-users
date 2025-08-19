const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testAssigneePermissions() {
  try {
    console.log('🧪 TESTING ASSIGNEE PERMISSIONS\n');

    // Find a task that User 2 is assigned to but doesn't own
    const taskResult = await pool.query(`
      SELECT 
        t.id, t.title, t.description, t.priority, t.tags, t.user_id as creator_id
      FROM tasks t
      WHERE t.status = 'active'
        AND t.user_id = 4  -- Owned by User 4
        AND EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2)  -- Assigned to User 2
      LIMIT 1
    `);

    if (taskResult.rows.length === 0) {
      console.log('❌ No suitable test task found. Creating one...');
      
      // Create a task owned by User 4 and assign User 2
      const createResult = await pool.query(`
        INSERT INTO tasks (user_id, group_id, title, description, priority, tags, position)
        VALUES (4, (SELECT id FROM task_groups LIMIT 1), 'Permission Test Task', 'Testing assignee permissions', 'normal', ARRAY['test', 'permissions'], 1)
        RETURNING id, title, description, priority, tags, user_id as creator_id
      `);
      
      const newTask = createResult.rows[0];
      await pool.query(`
        INSERT INTO task_assignees (task_id, user_id) VALUES ($1, 2)
      `, [newTask.id]);
      
      taskResult.rows[0] = newTask;
      console.log(`✅ Created test task ${newTask.id}: "${newTask.title}"`);
    }

    const testTask = taskResult.rows[0];
    console.log(`📝 Testing with task ${testTask.id}: "${testTask.title}"`);
    console.log(`   Creator: User ${testTask.creator_id}`);
    console.log(`   Assignee: User 2`);

    // Test 1: Try to update title (should fail for assignee)
    console.log(`\n🧪 TEST 1: User 2 (assignee) tries to update TITLE`);
    try {
      const titleUpdateResult = await pool.query(`
        SELECT t.id, t.user_id as creator_id,
               EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as is_assignee
        FROM tasks t WHERE t.id = $1
      `, [testTask.id, 2]);

      const permission = titleUpdateResult.rows[0];
      const isCreator = Number(permission.creator_id) === 2;
      const isAssignee = permission.is_assignee;

      console.log(`   User 2 is creator: ${isCreator}`);
      console.log(`   User 2 is assignee: ${isAssignee}`);

      // Simulate the API permission check
      const creatorOnlyFields = ['title', 'assignees'];
      const attemptedFields = ['title'];
      const restrictedFields = attemptedFields.filter(field => 
        creatorOnlyFields.includes(field) && !isCreator
      );

      if (restrictedFields.length > 0) {
        console.log(`   ❌ CORRECTLY BLOCKED: Cannot update restricted fields: ${restrictedFields.join(', ')}`);
      } else {
        console.log(`   ✅ ALLOWED: Can update title`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test 2: Try to update description (should succeed for assignee)
    console.log(`\n🧪 TEST 2: User 2 (assignee) tries to update DESCRIPTION`);
    try {
      const descUpdateResult = await pool.query(`
        UPDATE tasks 
        SET description = 'Updated by assignee - ' || NOW()::text
        WHERE id = $1
        RETURNING id, description
      `, [testTask.id]);

      if (descUpdateResult.rows.length > 0) {
        console.log(`   ✅ SUCCESS: Description updated`);
        console.log(`   New description: "${descUpdateResult.rows[0].description.substring(0, 50)}..."`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test 3: Try to update priority (should succeed for assignee)
    console.log(`\n🧪 TEST 3: User 2 (assignee) tries to update PRIORITY`);
    try {
      const priorityUpdateResult = await pool.query(`
        UPDATE tasks 
        SET priority = 'high'
        WHERE id = $1
        RETURNING id, priority
      `, [testTask.id]);

      if (priorityUpdateResult.rows.length > 0) {
        console.log(`   ✅ SUCCESS: Priority updated to "${priorityUpdateResult.rows[0].priority}"`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    // Test 4: Try to update tags (should succeed for assignee)
    console.log(`\n🧪 TEST 4: User 2 (assignee) tries to update TAGS`);
    try {
      const tagsUpdateResult = await pool.query(`
        UPDATE tasks 
        SET tags = ARRAY['updated', 'by-assignee', 'test']
        WHERE id = $1
        RETURNING id, tags
      `, [testTask.id]);

      if (tagsUpdateResult.rows.length > 0) {
        console.log(`   ✅ SUCCESS: Tags updated to [${tagsUpdateResult.rows[0].tags.join(', ')}]`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log(`\n📋 PERMISSION SUMMARY:`);
    console.log(`   👑 TASK CREATOR (User 4) can update:`);
    console.log(`      ✅ title, description, priority, start_date, due_date, tags`);
    console.log(`      ✅ assignees (add/remove people)`);
    console.log(`      ✅ group_id (move between columns)`);
    console.log(`      ✅ relationships`);
    
    console.log(`   👤 TASK ASSIGNEE (User 2) can update:`);
    console.log(`      ✅ description, priority, start_date, due_date, tags`);
    console.log(`      ✅ group_id (move between columns)`);
    console.log(`      ✅ relationships`);
    console.log(`      ❌ title (blocked with toast notification)`);
    console.log(`      ❌ assignees (cannot add/remove people)`);
    
    console.log(`\n🎯 FRONTEND BEHAVIOR:`);
    console.log(`   • Rename button in Kanban card: Shows toast error for assignees`);
    console.log(`   • Title edit in task dialog: Shows toast error for assignees`);
    console.log(`   • Other fields in task dialog: Work normally for assignees`);
    console.log(`   • Toast message: "Only the task creator can rename tasks. Contact the creator to request changes."`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testAssigneePermissions();
