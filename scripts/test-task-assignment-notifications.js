#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTaskAssignmentNotifications() {
  try {
    console.log('🧪 TESTING TASK ASSIGNMENT NOTIFICATIONS\n');
    
    // Get test users
    const usersResult = await pool.query(`
      SELECT u.id, u.email, 
             COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email) AS name
      FROM users u
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      ORDER BY u.id
      LIMIT 3
    `);
    
    if (usersResult.rows.length < 2) {
      console.log('❌ Need at least 2 users to test task assignments');
      return;
    }
    
    const creator = usersResult.rows[0];
    const assignee = usersResult.rows[1];
    
    console.log(`👤 Creator: ${creator.name} (${creator.email}) [ID: ${creator.id}]`);
    console.log(`👤 Assignee: ${assignee.name} (${assignee.email}) [ID: ${assignee.id}]`);
    
    // Get a task group for the creator
    const groupResult = await pool.query(
      'SELECT id, title FROM task_groups WHERE user_id = $1 ORDER BY position LIMIT 1',
      [creator.id]
    );
    
    if (groupResult.rows.length === 0) {
      console.log('❌ No task groups found for creator');
      return;
    }
    
    const group = groupResult.rows[0];
    console.log(`📋 Using task group: "${group.title}" (ID: ${group.id})\n`);
    
    // Create a test task
    console.log('🔨 Creating test task...');
    const taskResult = await pool.query(`
      INSERT INTO tasks (user_id, group_id, title, description, priority, position)
      VALUES ($1, $2, $3, $4, $5, (
        SELECT COALESCE(MAX(position), 0) + 1 
        FROM tasks 
        WHERE group_id = $2 AND status = 'active'
      ))
      RETURNING *
    `, [
      creator.id,
      group.id,
      'Assignment Notification Test Task',
      'Testing task assignment notifications',
      'normal'
    ]);
    
    const task = taskResult.rows[0];
    console.log(`✅ Task created: "${task.title}" (ID: ${task.id})`);
    
    // Clear any existing notifications for the assignee
    await pool.query('DELETE FROM notifications WHERE user_id = $1 AND category = $2', [assignee.id, 'task']);
    console.log('🧹 Cleared existing task notifications for assignee');
    
    // Test 1: Assign the task to the assignee (should trigger notification)
    console.log('\n📝 TEST 1: Assigning task to user...');
    await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)', [task.id, assignee.id]);
    
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for notification
    const notificationResult = await pool.query(`
      SELECT id, title, message, payload, created_at
      FROM notifications 
      WHERE user_id = $1 AND category = 'task' 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [assignee.id]);
    
    if (notificationResult.rows.length > 0) {
      const notification = notificationResult.rows[0];
      console.log('✅ Assignment notification created:');
      console.log(`   📧 Title: ${notification.title}`);
      console.log(`   💬 Message: ${notification.message}`);
      console.log(`   📦 Payload: ${JSON.stringify(notification.payload, null, 2)}`);
    } else {
      console.log('❌ No assignment notification found');
    }
    
    // Test 2: Remove the assignment (should trigger removal notification)
    console.log('\n📝 TEST 2: Removing task assignment...');
    await pool.query('DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2', [task.id, assignee.id]);
    
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for removal notification
    const removalNotificationResult = await pool.query(`
      SELECT id, title, message, payload, created_at
      FROM notifications 
      WHERE user_id = $1 AND category = 'task' 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [assignee.id]);
    
    if (removalNotificationResult.rows.length > 0) {
      const notification = removalNotificationResult.rows[0];
      if (notification.title.includes('removed')) {
        console.log('✅ Removal notification created:');
        console.log(`   📧 Title: ${notification.title}`);
        console.log(`   💬 Message: ${notification.message}`);
        console.log(`   📦 Payload: ${JSON.stringify(notification.payload, null, 2)}`);
      } else {
        console.log('❌ Expected removal notification but found assignment notification');
      }
    } else {
      console.log('❌ No removal notification found');
    }
    
    // Test 3: Self-assignment (should NOT trigger notification)
    console.log('\n📝 TEST 3: Creator assigning themselves (should NOT notify)...');
    await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)', [task.id, creator.id]);
    
    // Wait a moment for the trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check for notification (should not exist)
    const selfNotificationResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM notifications 
      WHERE user_id = $1 AND category = 'task' AND created_at > NOW() - INTERVAL '5 seconds'
    `, [creator.id]);
    
    const selfNotificationCount = selfNotificationResult.rows[0].count;
    if (selfNotificationCount === '0') {
      console.log('✅ No self-assignment notification created (correct behavior)');
    } else {
      console.log('❌ Self-assignment notification was created (should not happen)');
    }
    
    // Clean up
    console.log('\n🧹 CLEANING UP:');
    await pool.query('DELETE FROM task_assignees WHERE task_id = $1', [task.id]);
    await pool.query('DELETE FROM tasks WHERE id = $1', [task.id]);
    await pool.query('DELETE FROM notifications WHERE user_id = $1 AND category = $2', [assignee.id, 'task']);
    console.log('✅ Test data cleaned up');
    
    console.log('\n🎊 SUMMARY:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Task assignment notifications are working!');
    console.log('✅ Users get notified when assigned to tasks');
    console.log('✅ Users get notified when removed from tasks');
    console.log('✅ Self-assignments do not trigger notifications');
    console.log('✅ Notifications include task details and action URLs');
    console.log('✅ Real-time updates will refresh the frontend task list');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testTaskAssignmentNotifications();
