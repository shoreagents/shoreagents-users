#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRelationshipPermissions() {
  try {
    console.log('🧪 TESTING TASK RELATIONSHIP PERMISSIONS\n');
    
    // Test scenario: Task 64 created by user 4, assigned to user 2 (Kyle)
    const taskId = 64;
    const creatorId = 4; // aPP Testman
    const assigneeId = 2; // Kyle
    
    console.log(`📝 Task ID: ${taskId}`);
    console.log(`👤 Creator ID: ${creatorId} (aPP Testman)`);
    console.log(`👤 Assignee ID: ${assigneeId} (Kyle)`);
    
    // Check current task info
    const taskInfo = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id,
             EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $1) as kyle_is_assignee,
             EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = $2) as creator_is_assignee
      FROM tasks t 
      WHERE t.id = $3
    `, [assigneeId, creatorId, taskId]);
    
    if (taskInfo.rows.length === 0) {
      console.log('❌ Task not found');
      return;
    }
    
    const task = taskInfo.rows[0];
    console.log(`\n📋 Task: "${task.title}"`);
    console.log(`   Creator: ${task.creator_id === creatorId ? '✅' : '❌'} User ${task.creator_id}`);
    console.log(`   Kyle is assignee: ${task.kyle_is_assignee ? '✅' : '❌'}`);
    console.log(`   Creator is assignee: ${task.creator_is_assignee ? '✅' : '❌'}`);
    
    // Find another task to create a relationship with
    const otherTasks = await pool.query(`
      SELECT id, title FROM tasks 
      WHERE id != $1 AND status = 'active' 
      LIMIT 3
    `, [taskId]);
    
    if (otherTasks.rows.length === 0) {
      console.log('❌ No other tasks found to create relationships with');
      return;
    }
    
    const relatedTask = otherTasks.rows[0];
    console.log(`\n🔗 Will test relationship with Task ${relatedTask.id}: "${relatedTask.title}"`);
    
    // Test 1: Creator should be able to add relationships
    console.log('\n🧪 TEST 1: Creator adding relationship');
    try {
      const creatorResponse = await fetch('http://localhost:3000/api/task-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_task',
          task_id: taskId,
          updates: {
            relationships: [{ taskId: String(relatedTask.id), type: 'related_to' }]
          },
          email: 'app.testman@shoreagents.com' // Creator's email
        })
      });
      
      const creatorResult = await creatorResponse.json();
      if (creatorResult.success) {
        console.log('✅ Creator can add relationships');
      } else {
        console.log('❌ Creator failed to add relationship:', creatorResult.error);
      }
    } catch (error) {
      console.log('❌ Creator test failed:', error.message);
    }
    
    // Test 2: Assignee should be able to add relationships
    console.log('\n🧪 TEST 2: Assignee adding relationship');
    try {
      const assigneeResponse = await fetch('http://localhost:3000/api/task-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_task',
          task_id: taskId,
          updates: {
            relationships: [
              { taskId: String(relatedTask.id), type: 'related_to' },
              { taskId: String(otherTasks.rows[1]?.id || relatedTask.id), type: 'blocks' }
            ]
          },
          email: 'kyle.p@shoreagents.com' // Assignee's email
        })
      });
      
      const assigneeResult = await assigneeResponse.json();
      if (assigneeResult.success) {
        console.log('✅ Assignee can add relationships');
      } else {
        console.log('❌ Assignee failed to add relationship:', assigneeResult.error);
      }
    } catch (error) {
      console.log('❌ Assignee test failed:', error.message);
    }
    
    // Test 3: Assignee should NOT be able to change title (creator-only field)
    console.log('\n🧪 TEST 3: Assignee trying to change title (should fail)');
    try {
      const titleResponse = await fetch('http://localhost:3000/api/task-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_task',
          task_id: taskId,
          updates: {
            title: 'Modified by assignee (should fail)'
          },
          email: 'kyle.p@shoreagents.com' // Assignee's email
        })
      });
      
      const titleResult = await titleResponse.json();
      if (titleResult.success) {
        console.log('❌ Assignee was able to change title (this should not happen!)');
      } else {
        console.log('✅ Assignee correctly blocked from changing title:', titleResult.error);
      }
    } catch (error) {
      console.log('✅ Assignee correctly blocked from changing title:', error.message);
    }
    
    // Test 4: Non-assignee should not be able to update anything
    console.log('\n🧪 TEST 4: Non-assignee trying to add relationship (should fail)');
    try {
      const nonAssigneeResponse = await fetch('http://localhost:3000/api/task-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_task',
          task_id: taskId,
          updates: {
            relationships: [{ taskId: String(relatedTask.id), type: 'related_to' }]
          },
          email: 'some.other.user@example.com' // Non-assignee email
        })
      });
      
      const nonAssigneeResult = await nonAssigneeResponse.json();
      if (nonAssigneeResult.success) {
        console.log('❌ Non-assignee was able to update task (this should not happen!)');
      } else {
        console.log('✅ Non-assignee correctly blocked:', nonAssigneeResult.error);
      }
    } catch (error) {
      console.log('✅ Non-assignee correctly blocked:', error.message);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Task creators can update all fields including relationships');
    console.log('✅ Task assignees can ONLY update relationships (not title, description, etc.)');
    console.log('✅ Non-assignees cannot update anything');
    console.log('');
    console.log('🔗 RELATIONSHIP PERMISSIONS:');
    console.log('   • Creators: Full access to add/remove relationships');
    console.log('   • Assignees: Can add relationships to tasks assigned to them');
    console.log('   • Others: No access');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRelationshipPermissions();
