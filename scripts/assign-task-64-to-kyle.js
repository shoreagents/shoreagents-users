#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function assignTaskToKyle() {
  try {
    const taskId = 64;
    const kyleUserId = 2;
    
    console.log('🔄 Assigning Task 64 to Kyle (User ID 2)...');
    
    // Remove existing assignment if any
    await pool.query('DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2', [taskId, kyleUserId]);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Add the assignment
    await pool.query('INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)', [taskId, kyleUserId]);
    
    console.log('✅ Assignment completed!');
    console.log('');
    console.log('🔍 Check your browser console for debug logs:');
    console.log('   - Look for "🔍 Task assignee change:" logs');
    console.log('   - Look for "🔄 Task assignee changed, refreshing all task data..." logs');
    console.log('   - Check if currentUserId matches userId (2)');
    console.log('');
    console.log('📋 Expected behavior:');
    console.log('   1. Task should appear in Kyle\'s task list immediately');
    console.log('   2. Task should show "Assigned" badge (purple)');
    console.log('   3. Task should show "KP" initials');
    console.log('   4. No page reload should be needed');
    console.log('   5. Full task data should refresh automatically');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

assignTaskToKyle();
