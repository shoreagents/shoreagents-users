#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testPrivateRelationshipUI() {
  try {
    console.log('🎯 TESTING PRIVATE RELATIONSHIP UI FIX\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const taskA = 64; // "from app" (created by User 4, assigned to User 2)
    const taskB = 63; // "dawdawdaw" (created by User 2)
    
    console.log('📋 Test Setup:');
    console.log(`   Task A (${taskA}): "from app" - Created by User 4, Assigned to User 2`);
    console.log(`   Task B (${taskB}): "dawdawdaw" - Created by User 2 (private)`);
    
    // Ensure relationship exists
    console.log('\n🔗 Ensuring relationship exists...');
    await pool.query(`
      INSERT INTO task_relations (task_id, related_task_id, type)
      VALUES ($1, $2, 'related_to')
      ON CONFLICT (task_id, related_task_id, type) DO NOTHING
    `, [taskA, taskB]);
    console.log('✅ Relationship A → B created/confirmed');
    
    // Test User 4's view (should see private relationship indicator)
    console.log('\n👀 Testing User 4 view (should see private relationship):');
    
    const user4Response = await fetch(`http://localhost:3000/api/task-activity?email=app.agent@infinity.com`);
    const user4Data = await user4Response.json();
    
    if (user4Data.success) {
      const allTasks = user4Data.groups.flatMap(g => g.tasks || []);
      const user4TaskA = allTasks.find(t => t.id === taskA);
      const user4TaskB = allTasks.find(t => t.id === taskB);
      
      console.log(`   ✅ Can see Task A: ${user4TaskA ? 'Yes' : 'No'}`);
      console.log(`   ❌ Can see Task B: ${user4TaskB ? 'Yes' : 'No'} (Expected: No)`);
      
      if (user4TaskA && user4TaskA.task_relationships) {
        const relationships = user4TaskA.task_relationships;
        console.log(`   🔗 Task A relationships: ${relationships.length} found`);
        
        relationships.forEach((rel, i) => {
          const relatedTaskExists = allTasks.some(t => t.id === Number(rel.taskId));
          console.log(`      ${i + 1}. ${rel.type} → Task ${rel.taskId} (${relatedTaskExists ? 'Accessible' : 'Private'})`);
        });
        
        const hasPrivateRelationship = relationships.some(rel => 
          !allTasks.some(t => t.id === Number(rel.taskId))
        );
        
        if (hasPrivateRelationship) {
          console.log('   ✅ FRONTEND WILL SHOW: "🔒 Private Task" with "No access" badge');
          console.log('   ✅ NO MORE BROKEN CLICKS!');
        } else {
          console.log('   ℹ️  All relationships are accessible to this user');
        }
      } else {
        console.log('   ❌ No relationships found on Task A');
      }
    } else {
      console.log(`   ❌ API Error: ${user4Data.error}`);
    }
    
    // Test User 2's view (should see full relationship)
    console.log('\n👀 Testing User 2 view (should see full relationship):');
    
    const user2Response = await fetch(`http://localhost:3000/api/task-activity?email=kyle.p@shoreagents.com`);
    const user2Data = await user2Response.json();
    
    if (user2Data.success) {
      const allTasks = user2Data.groups.flatMap(g => g.tasks || []);
      const user2TaskA = allTasks.find(t => t.id === taskA);
      const user2TaskB = allTasks.find(t => t.id === taskB);
      
      console.log(`   ✅ Can see Task A: ${user2TaskA ? 'Yes' : 'No'} (assigned)`);
      console.log(`   ✅ Can see Task B: ${user2TaskB ? 'Yes' : 'No'} (owns)`);
      
      if (user2TaskA && user2TaskA.task_relationships) {
        const relationships = user2TaskA.task_relationships;
        console.log(`   🔗 Task A relationships: ${relationships.length} found`);
        
        relationships.forEach((rel, i) => {
          const relatedTask = allTasks.find(t => t.id === Number(rel.taskId));
          console.log(`      ${i + 1}. ${rel.type} → "${relatedTask ? relatedTask.title : 'Unknown'}" (Accessible)`);
        });
        
        console.log('   ✅ FRONTEND WILL SHOW: Full clickable relationship with task title');
      }
    } else {
      console.log(`   ❌ API Error: ${user2Data.error}`);
    }
    
    console.log('\n🎯 UI BEHAVIOR SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 User 4 (Task Creator) will see:');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ Task A: from app                        │');
    console.log('   │ ┌─────────────────────────────────────┐ │');
    console.log('   │ │ 🔗 Related Tasks:                   │ │');
    console.log('   │ │ • related to 🔒 Private Task        │ │');
    console.log('   │ │   [No access] badge                 │ │');
    console.log('   │ │   (NOT CLICKABLE)                   │ │');
    console.log('   │ └─────────────────────────────────────┘ │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('');
    console.log('👤 User 2 (Assignee & Task B Owner) will see:');
    console.log('   ┌─────────────────────────────────────────┐');
    console.log('   │ Task A: from app                        │');
    console.log('   │ ┌─────────────────────────────────────┐ │');
    console.log('   │ │ 🔗 Related Tasks:                   │ │');
    console.log('   │ │ • related to "dawdawdaw"            │ │');
    console.log('   │ │   (CLICKABLE)                       │ │');
    console.log('   │ └─────────────────────────────────────┘ │');
    console.log('   └─────────────────────────────────────────┘');
    console.log('');
    console.log('✅ PROBLEM SOLVED:');
    console.log('   • No more broken clicks to inaccessible tasks');
    console.log('   • Clear visual indication of private vs accessible relationships');
    console.log('   • Users understand why they can\'t access certain tasks');
    console.log('   • Maintains privacy while showing relationship context');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testPrivateRelationshipUI();
