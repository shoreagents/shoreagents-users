#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFixedVisibility() {
  try {
    console.log('🧪 TESTING FIXED TASK GROUP VISIBILITY\n');
    
    const user2 = 2; // Kyle
    const user4 = 4; // aPP Testman
    
    console.log('👥 Test Users:');
    console.log(`   User ${user2}: Kyle Pantig`);
    console.log(`   User ${user4}: aPP Testman`);
    
    // Test User 4 visibility (should now see their tasks)
    console.log(`\n👀 User ${user4} (aPP Testman) visibility test:`);
    
    const user4Response = await fetch(`http://localhost:3000/api/task-activity?email=app.agent@infinity.com`);
    const user4Data = await user4Response.json();
    
    if (user4Data.success) {
      console.log(`✅ API call successful`);
      console.log(`📊 Groups returned: ${user4Data.groups.length}`);
      
      const allTasks = user4Data.groups.flatMap(g => g.tasks || []);
      console.log(`📋 Total tasks visible: ${allTasks.length}`);
      
      // Check for specific tasks
      const taskA = allTasks.find(t => t.id === 64); // "from app" created by User 4
      const taskB = allTasks.find(t => t.id === 63); // "dawdawdaw" created by User 2
      
      console.log(`\n📋 Task Visibility:`);
      console.log(`   Task 64 ("from app" - created by User 4): ${taskA ? '✅ Visible' : '❌ Hidden'}`);
      if (taskA) {
        console.log(`      ├─ Title: "${taskA.title}"`);
        console.log(`      ├─ Creator: User ${taskA.creator_id}`);
        console.log(`      ├─ Is Owner: ${taskA.is_owner}`);
        console.log(`      └─ Group: ${taskA.group_id || 'None'}`);
      }
      
      console.log(`   Task 63 ("dawdawdaw" - created by User 2): ${taskB ? '✅ Visible' : '❌ Hidden'}`);
      if (taskB) {
        console.log(`      ├─ Title: "${taskB.title}"`);
        console.log(`      ├─ Creator: User ${taskB.creator_id}`);
        console.log(`      ├─ Is Owner: ${taskB.is_owner}`);
        console.log(`      └─ Group: ${taskB.group_id || 'None'}`);
      }
      
      // Show all groups
      console.log(`\n📁 Groups visible to User ${user4}:`);
      user4Data.groups.forEach(group => {
        console.log(`   Group ${group.id}: "${group.title}" (${group.tasks.length} tasks)`);
        group.tasks.forEach(task => {
          const ownership = task.is_owner ? 'owns' : 'assigned';
          console.log(`      └─ Task ${task.id}: "${task.title}" (${ownership})`);
        });
      });
      
    } else {
      console.log(`❌ API call failed: ${user4Data.error}`);
    }
    
    // Test User 2 visibility (should still work)
    console.log(`\n👀 User ${user2} (Kyle) visibility test:`);
    
    const user2Response = await fetch(`http://localhost:3000/api/task-activity?email=kyle.p@shoreagents.com`);
    const user2Data = await user2Response.json();
    
    if (user2Data.success) {
      const allTasks = user2Data.groups.flatMap(g => g.tasks || []);
      console.log(`✅ Can see ${allTasks.length} tasks across ${user2Data.groups.length} groups`);
      
      const taskA = allTasks.find(t => t.id === 64);
      const taskB = allTasks.find(t => t.id === 63);
      
      console.log(`   Task 64: ${taskA ? '✅ Visible' : '❌ Hidden'}`);
      console.log(`   Task 63: ${taskB ? '✅ Visible' : '❌ Hidden'}`);
    } else {
      console.log(`❌ API call failed: ${user2Data.error}`);
    }
    
    console.log('\n🎯 EXPECTED RESULTS AFTER FIX:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ User 4 should now see Task 64 (their own task)');
    console.log('❌ User 4 should NOT see Task 63 (not assigned to it)');
    console.log('✅ User 2 should see both tasks (owns one, assigned to other)');
    console.log('✅ Task groups are now shared/visible to all users');
    console.log('✅ Users only see tasks they own OR are assigned to');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testFixedVisibility();
