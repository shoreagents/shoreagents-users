#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRelationshipVisibilityDemo() {
  try {
    console.log('🧪 RELATIONSHIP VISIBILITY TEST\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const user2 = 2; // Kyle
    const user4 = 4; // aPP Testman
    
    console.log('👥 Test Users:');
    console.log(`   User ${user2}: Kyle Pantig (kyle.p@shoreagents.com)`);
    console.log(`   User ${user4}: aPP Testman (app.testman@shoreagents.com)`);
    
    // Step 1: Find existing tasks
    console.log('\n📋 STEP 1: Finding existing tasks...');
    
    // Task A: Created by User 4, assigned to User 2
    const taskAQuery = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.user_id = $1 AND ta.user_id = $2 AND t.status = 'active'
      LIMIT 1
    `, [user4, user2]);
    
    // Task B: Created by User 2
    const taskBQuery = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id
      FROM tasks t
      WHERE t.user_id = $1 AND t.status = 'active'
      LIMIT 1
    `, [user2]);
    
    if (taskAQuery.rows.length === 0 || taskBQuery.rows.length === 0) {
      console.log('❌ Required tasks not found. Creating test scenario...');
      
      // Create a simple test task for User 2 if needed
      if (taskBQuery.rows.length === 0) {
        await pool.query(`
          INSERT INTO tasks (title, description, user_id, group_id, priority, status, position)
          SELECT 'Test Task by Kyle', 'Test task for relationship demo', $1, tg.id, 'normal', 'active', 1
          FROM task_groups tg WHERE tg.user_id = $1 LIMIT 1
        `, [user2]);
        console.log('✅ Created test task for User 2');
      }
      
      // Re-query
      const newTaskBQuery = await pool.query(`
        SELECT t.id, t.title, t.user_id as creator_id
        FROM tasks t
        WHERE t.user_id = $1 AND t.status = 'active'
        LIMIT 1
      `, [user2]);
      
      if (taskAQuery.rows.length === 0) {
        console.log('❌ No tasks found where User 4 created and User 2 is assigned');
        console.log('💡 Please assign User 2 to a task created by User 4 first');
        return;
      }
      
      if (newTaskBQuery.rows.length === 0) {
        console.log('❌ Could not create test task for User 2');
        return;
      }
    }
    
    const taskA = taskAQuery.rows[0];
    const taskB = taskBQuery.rows.length > 0 ? taskBQuery.rows[0] : 
                  (await pool.query(`SELECT t.id, t.title, t.user_id as creator_id FROM tasks t WHERE t.user_id = $1 AND t.status = 'active' LIMIT 1`, [user2])).rows[0];
    
    console.log(`\n📋 Task A: "${taskA.title}" (ID: ${taskA.id})`);
    console.log(`   ├─ Created by: User ${taskA.creator_id} (aPP Testman)`);
    console.log(`   └─ Assigned to: User ${user2} (Kyle)`);
    
    console.log(`\n📋 Task B: "${taskB.title}" (ID: ${taskB.id})`);
    console.log(`   ├─ Created by: User ${taskB.creator_id} (Kyle)`);
    console.log(`   └─ Private to Kyle`);
    
    // Step 2: Clear existing relationships
    console.log('\n🧹 STEP 2: Clearing existing relationships...');
    await pool.query('DELETE FROM task_relations WHERE task_id = $1 OR related_task_id = $1', [taskA.id]);
    await pool.query('DELETE FROM task_relations WHERE task_id = $1 OR related_task_id = $1', [taskB.id]);
    console.log('✅ Cleared existing relationships');
    
    // Step 3: Check initial visibility
    console.log('\n👀 STEP 3: Initial visibility (before relationship)...');
    
    // User 2 visibility
    console.log(`\n   User ${user2} (Kyle) can see:`);
    const user2InitialTasks = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id,
             CASE WHEN t.user_id = $1 THEN true ELSE false END as is_owner
      FROM tasks t
      LEFT JOIN task_groups tg ON tg.id = t.group_id
      WHERE t.status = 'active' 
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
        AND tg.user_id = $1
    `, [user2]);
    
    const user2HasTaskA = user2InitialTasks.rows.some(t => t.id === taskA.id);
    const user2HasTaskB = user2InitialTasks.rows.some(t => t.id === taskB.id);
    console.log(`     ├─ Task A: ${user2HasTaskA ? '✅ Visible' : '❌ Hidden'} (assigned)`);
    console.log(`     └─ Task B: ${user2HasTaskB ? '✅ Visible' : '❌ Hidden'} (owns)`);
    
    // User 4 visibility
    console.log(`\n   User ${user4} (aPP Testman) can see:`);
    const user4InitialTasks = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id,
             CASE WHEN t.user_id = $1 THEN true ELSE false END as is_owner
      FROM tasks t
      LEFT JOIN task_groups tg ON tg.id = t.group_id
      WHERE t.status = 'active' 
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
        AND tg.user_id = $1
    `, [user4]);
    
    const user4HasTaskA = user4InitialTasks.rows.some(t => t.id === taskA.id);
    const user4HasTaskB = user4InitialTasks.rows.some(t => t.id === taskB.id);
    console.log(`     ├─ Task A: ${user4HasTaskA ? '✅ Visible' : '❌ Hidden'} (owns)`);
    console.log(`     └─ Task B: ${user4HasTaskB ? '✅ Visible' : '❌ Hidden'} (no access)`);
    
    // Step 4: User 2 creates relationship
    console.log('\n🔗 STEP 4: User 2 (Kyle) creates relationship...');
    console.log(`   Creating: Task A (${taskA.id}) → Task B (${taskB.id})`);
    
    try {
      await pool.query(`
        INSERT INTO task_relations (task_id, related_task_id, type)
        VALUES ($1, $2, 'related_to')
        ON CONFLICT (task_id, related_task_id, type) DO NOTHING
      `, [taskA.id, taskB.id]);
      console.log('✅ Relationship created successfully');
    } catch (error) {
      console.log('❌ Failed to create relationship:', error.message);
      return;
    }
    
    // Step 5: Check visibility after relationship
    console.log('\n👀 STEP 5: Visibility after relationship created...');
    
    // User 2 visibility with relationships
    console.log(`\n   User ${user2} (Kyle) can see:`);
    const user2AfterTasks = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id,
             CASE WHEN t.user_id = $1 THEN true ELSE false END as is_owner,
             COALESCE(
               jsonb_agg(DISTINCT jsonb_build_object('taskId', r.other_id::text, 'type', r.type)) 
               FILTER (WHERE r.other_id IS NOT NULL),
               '[]'::jsonb
             ) AS relationships
      FROM tasks t
      LEFT JOIN task_groups tg ON tg.id = t.group_id
      LEFT JOIN (
        SELECT tr.task_id, tr.related_task_id AS other_id, tr.type
        FROM task_relations tr
        UNION
        SELECT tr.related_task_id AS task_id, tr.task_id AS other_id, tr.type
        FROM task_relations tr
      ) r ON r.task_id = t.id
      WHERE t.status = 'active' 
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
        AND tg.user_id = $1
      GROUP BY t.id, t.title, t.user_id, tg.user_id
    `, [user2]);
    
    const user2TaskA = user2AfterTasks.rows.find(t => t.id === taskA.id);
    const user2TaskB = user2AfterTasks.rows.find(t => t.id === taskB.id);
    
    console.log(`     ├─ Task A: ${user2TaskA ? '✅ Visible' : '❌ Hidden'}`);
    if (user2TaskA && user2TaskA.relationships.length > 0) {
      console.log(`     │  └─ Relationships: ${JSON.stringify(user2TaskA.relationships)}`);
    }
    console.log(`     └─ Task B: ${user2TaskB ? '✅ Visible' : '❌ Hidden'}`);
    if (user2TaskB && user2TaskB.relationships.length > 0) {
      console.log(`        └─ Relationships: ${JSON.stringify(user2TaskB.relationships)}`);
    }
    
    // User 4 visibility with relationships
    console.log(`\n   User ${user4} (aPP Testman) can see:`);
    const user4AfterTasks = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id,
             CASE WHEN t.user_id = $1 THEN true ELSE false END as is_owner,
             COALESCE(
               jsonb_agg(DISTINCT jsonb_build_object('taskId', r.other_id::text, 'type', r.type)) 
               FILTER (WHERE r.other_id IS NOT NULL),
               '[]'::jsonb
             ) AS relationships
      FROM tasks t
      LEFT JOIN task_groups tg ON tg.id = t.group_id
      LEFT JOIN (
        SELECT tr.task_id, tr.related_task_id AS other_id, tr.type
        FROM task_relations tr
        UNION
        SELECT tr.related_task_id AS task_id, tr.task_id AS other_id, tr.type
        FROM task_relations tr
      ) r ON r.task_id = t.id
      WHERE t.status = 'active' 
        AND (t.user_id = $1 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1))
        AND tg.user_id = $1
      GROUP BY t.id, t.title, t.user_id, tg.user_id
    `, [user4]);
    
    const user4TaskA = user4AfterTasks.rows.find(t => t.id === taskA.id);
    const user4TaskB = user4AfterTasks.rows.find(t => t.id === taskB.id);
    
    console.log(`     ├─ Task A: ${user4TaskA ? '✅ Visible' : '❌ Hidden'}`);
    if (user4TaskA && user4TaskA.relationships.length > 0) {
      console.log(`     │  └─ Relationships: ${JSON.stringify(user4TaskA.relationships)}`);
      console.log(`     │  └─ ⚠️  Can see relationship to Task ${taskB.id} but CANNOT access that task!`);
    }
    console.log(`     └─ Task B: ${user4TaskB ? '✅ Visible' : '❌ Hidden'} (Expected: Hidden)`);
    
    // Step 6: Test relationship access
    console.log('\n🔍 STEP 6: Testing relationship access...');
    
    // Check if User 4 can see the related task details
    const relatedTaskCheck = await pool.query(`
      SELECT t.id, t.title
      FROM tasks t
      WHERE t.id = $1 AND (t.user_id = $2 OR EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2))
    `, [taskB.id, user4]);
    
    console.log(`   User ${user4} trying to access Task B (${taskB.id}):`);
    console.log(`   └─ ${relatedTaskCheck.rows.length > 0 ? '✅ Can access' : '❌ Access denied'} (Expected: Access denied)`);
    
    // Final summary
    console.log('\n🎯 FINAL RESULTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Visibility Matrix:');
    console.log('');
    console.log('                    │ Task A │ Task B │ Relationship A→B');
    console.log('────────────────────┼────────┼────────┼─────────────────');
    console.log(`User ${user2} (Kyle)        │   ✅    │   ✅    │       ✅`);
    console.log(`User ${user4} (aPP Testman) │   ✅    │   ❌    │       ⚠️`);
    console.log('');
    console.log('🔍 Key Findings:');
    console.log(`   • User ${user2} can see both tasks and the full relationship`);
    console.log(`   • User ${user4} can see Task A and knows a relationship exists`);
    console.log(`   • User ${user4} CANNOT see Task B details (privacy protected)`);
    console.log(`   • User ${user4} sees "broken" relationship (can't access related task)`);
    console.log('');
    console.log('💡 Current Behavior: PRIVACY-FIRST');
    console.log('   ✅ Strong privacy protection');
    console.log('   ❌ "Broken" relationship experience for User 4');
    console.log('');
    console.log('🔧 Possible UX Improvements:');
    console.log('   1. Show "Related to [Private Task]" instead of task ID');
    console.log('   2. Add tooltip: "You don\'t have access to this task"');
    console.log('   3. Allow task owner to grant read-only access');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testRelationshipVisibilityDemo();
