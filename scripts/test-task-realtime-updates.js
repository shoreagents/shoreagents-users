#!/usr/bin/env node

/**
 * Test script to verify task real-time updates are working
 * This script will:
 * 1. Connect to the database
 * 2. Insert/update a test task
 * 3. Verify the trigger fires and sends notifications
 */

const { Pool } = require('pg');

// Database connection - use the same configuration as socket-server.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testTaskRealtimeUpdates() {
  console.log('🧪 Testing task real-time updates...\n');
  
  let client;
  try {
    // Test database connection
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if task triggers exist
    const triggerCheck = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE trigger_name LIKE '%task%' 
      AND event_object_table = 'tasks'
    `);
    
    console.log('\n📋 Task triggers found:');
    if (triggerCheck.rows.length === 0) {
      console.log('❌ No task triggers found! This is likely the issue.');
      console.log('💡 Run the migration: migrations/038_task_realtime_triggers.sql');
      return;
    }
    
    triggerCheck.rows.forEach(trigger => {
      console.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`);
    });
    
    // Check if we have any task groups
    const groupsResult = await client.query('SELECT id, title FROM task_groups LIMIT 3');
    console.log('\n📁 Available task groups:');
    if (groupsResult.rows.length === 0) {
      console.log('❌ No task groups found! Create some groups first.');
      return;
    }
    
    groupsResult.rows.forEach(group => {
      console.log(`  - ${group.id}: ${group.title}`);
    });
    
    const testGroupId = groupsResult.rows[0].id;
    
    // Get a test user ID (use the first available user)
    const userResult = await client.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found! Create a user first.');
      return;
    }
    const testUserId = userResult.rows[0].id;
    console.log(`\n👤 Using test user ID: ${testUserId}`);
    
    // Create a test task
    console.log(`\n🆕 Creating test task in group ${testGroupId}...`);
    const insertResult = await client.query(`
      INSERT INTO tasks (title, description, group_id, position, status, user_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, title
    `, ['Test Task for Realtime', 'This is a test task to verify real-time updates', testGroupId, 1, 'active', testUserId]);
    
    const testTaskId = insertResult.rows[0].id;
    console.log(`✅ Test task created with ID: ${testTaskId}`);
    
    // Wait a moment for the trigger to fire
    console.log('\n⏳ Waiting for trigger to fire...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the test task
    console.log(`\n🔄 Updating test task ${testTaskId}...`);
    await client.query(`
      UPDATE tasks 
      SET title = $1, updated_at = NOW()
      WHERE id = $2
    `, ['Updated Test Task for Realtime', testTaskId]);
    
    console.log('✅ Test task updated');
    
    // Wait a moment for the trigger to fire
    console.log('\n⏳ Waiting for trigger to fire...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clean up - delete the test task
    console.log(`\n🗑️ Cleaning up test task ${testTaskId}...`);
    await client.query('DELETE FROM tasks WHERE id = $1', [testTaskId]);
    console.log('✅ Test task deleted');
    
    console.log('\n🎉 Test completed!');
    console.log('\n💡 To verify real-time updates are working:');
    console.log('1. Make sure the socket server is running: npm run socket');
    console.log('2. Open the task-activity page in your browser');
    console.log('3. Run this test script again');
    console.log('4. Check the browser console for "Received task_updated event" messages');
    console.log('5. The task should appear/disappear in real-time on the page');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n💡 Make sure:');
    console.error('  - Your database is running');
    console.error('  - DATABASE_URL environment variable is set correctly');
    console.error('  - You have network access to the database');
    console.error('  - The task triggers migration has been run');
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testTaskRealtimeUpdates().catch(console.error);
