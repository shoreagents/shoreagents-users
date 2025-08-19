#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRelationshipVisibility() {
  try {
    console.log('🧪 TESTING TASK RELATIONSHIP VISIBILITY\n');
    
    // Test scenario:
    // - Task A: Created by User 4, assigned to User 2
    // - Task B: Created by User 2
    // - User 2 creates relationship: Task A → Task B
    // - Question: Can User 4 see Task B?
    
    const user2 = 2; // Kyle
    const user4 = 4; // aPP Testman
    
    console.log('👥 Users:');
    console.log(`   User ${user2}: Kyle Pantig`);
    console.log(`   User ${user4}: aPP Testman`);
    
    // Find Task A (created by User 4, assigned to User 2)
    const taskAQuery = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id
      FROM tasks t
      JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.user_id = $1 AND ta.user_id = $2 AND t.status = 'active'
      LIMIT 1
    `, [user4, user2]);
    
    if (taskAQuery.rows.length === 0) {
      console.log('❌ No suitable Task A found (created by User 4, assigned to User 2)');
      return;
    }
    
    const taskA = taskAQuery.rows[0];
    console.log(`\n📋 Task A: "${taskA.title}" (ID: ${taskA.id})`);
    console.log(`   Created by: User ${taskA.creator_id}`);
    console.log(`   Assigned to: User ${user2}`);
    
    // Find Task B (created by User 2)
    const taskBQuery = await pool.query(`
      SELECT t.id, t.title, t.user_id as creator_id
      FROM tasks t
      WHERE t.user_id = $1 AND t.status = 'active' AND t.id != $2
      LIMIT 1
    `, [user2, taskA.id]);
    
    if (taskBQuery.rows.length === 0) {
      console.log('❌ No suitable Task B found (created by User 2)');
      return;
    }
    
    const taskB = taskBQuery.rows[0];
    console.log(`\n📋 Task B: "${taskB.title}" (ID: ${taskB.id})`);
    console.log(`   Created by: User ${taskB.creator_id}`);
    
    // Create relationship: Task A → Task B (User 2 does this)
    console.log(`\n🔗 User ${user2} creating relationship: Task A → Task B`);
    
    try {
      const relationshipResponse = await fetch('http://localhost:3000/api/task-activity?email=kyle.p@shoreagents.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_task',
          task_id: taskA.id,
          updates: {
            relationships: [{ taskId: String(taskB.id), type: 'related_to' }]
          }
        })
      });
      
      const relationshipResult = await relationshipResponse.json();
      if (relationshipResult.success) {
        console.log('✅ Relationship created successfully');
      } else {
        console.log('❌ Failed to create relationship:', relationshipResult.error);
        return;
      }
    } catch (error) {
      console.log('❌ Error creating relationship:', error.message);
      return;
    }
    
    // Test visibility for User 2 (should see both tasks)
    console.log(`\n👀 Testing visibility for User ${user2} (Kyle):`);
    try {
      const user2Response = await fetch(`http://localhost:3000/api/task-activity?email=kyle.p@shoreagents.com`);
      const user2Data = await user2Response.json();
      
      if (user2Data.success) {
        const allTasks = user2Data.groups.flatMap(g => g.tasks || []);
        const hasTaskA = allTasks.some(t => t.id === taskA.id);
        const hasTaskB = allTasks.some(t => t.id === taskB.id);
        
        console.log(`   Can see Task A: ${hasTaskA ? '✅' : '❌'}`);
        console.log(`   Can see Task B: ${hasTaskB ? '✅' : '❌'}`);
        
        // Check if Task A shows the relationship
        const taskAData = allTasks.find(t => t.id === taskA.id);
        if (taskAData && taskAData.task_relationships) {
          const hasRelationship = taskAData.task_relationships.some(r => r.taskId === String(taskB.id));
          console.log(`   Task A shows relationship to Task B: ${hasRelationship ? '✅' : '❌'}`);
        }
      } else {
        console.log('❌ Failed to fetch User 2 data:', user2Data.error);
      }
    } catch (error) {
      console.log('❌ Error fetching User 2 data:', error.message);
    }
    
    // Test visibility for User 4 (should see Task A but NOT Task B)
    console.log(`\n👀 Testing visibility for User ${user4} (aPP Testman):`);
    try {
      const user4Response = await fetch(`http://localhost:3000/api/task-activity?email=app.testman@shoreagents.com`);
      const user4Data = await user4Response.json();
      
      if (user4Data.success) {
        const allTasks = user4Data.groups.flatMap(g => g.tasks || []);
        const hasTaskA = allTasks.some(t => t.id === taskA.id);
        const hasTaskB = allTasks.some(t => t.id === taskB.id);
        
        console.log(`   Can see Task A: ${hasTaskA ? '✅' : '❌'}`);
        console.log(`   Can see Task B: ${hasTaskB ? '✅' : '❌'} ${!hasTaskB ? '(Expected - not assigned)' : '(Unexpected!)'}`);
        
        // Check if Task A shows the relationship (but User 4 can't see the related task)
        const taskAData = allTasks.find(t => t.id === taskA.id);
        if (taskAData && taskAData.task_relationships) {
          const hasRelationship = taskAData.task_relationships.some(r => r.taskId === String(taskB.id));
          console.log(`   Task A shows relationship to Task B: ${hasRelationship ? '✅' : '❌'}`);
          if (hasRelationship) {
            console.log(`   ⚠️  User ${user4} can see the relationship exists but cannot access Task B`);
          }
        }
      } else {
        console.log('❌ Failed to fetch User 4 data:', user4Data.error);
      }
    } catch (error) {
      console.log('❌ Error fetching User 4 data:', error.message);
    }
    
    console.log('\n🎯 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Current Behavior:');
    console.log(`   • User ${user2} can see both Task A and Task B (owns B, assigned to A)`);
    console.log(`   • User ${user4} can see Task A but NOT Task B (owns A, not assigned to B)`);
    console.log(`   • User ${user4} can see that Task A has a relationship, but cannot access the related task`);
    console.log('');
    console.log('🔒 Privacy Implications:');
    console.log('   • Task relationships do NOT grant visibility to related tasks');
    console.log('   • Users can only see tasks they own or are assigned to');
    console.log('   • Relationships may appear "broken" if the related task is not visible');
    console.log('');
    console.log('💡 Potential Solutions:');
    console.log('   1. Keep current behavior (privacy-first)');
    console.log('   2. Grant read-only access to related tasks');
    console.log('   3. Show relationship exists but hide task details');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testRelationshipVisibility();
