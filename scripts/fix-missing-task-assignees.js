#!/usr/bin/env node

/**
 * Script to fix missing task assignees
 * This script will add the task creator as an assignee for tasks where they're missing
 */

const { Pool } = require('pg');

// Database connection - use the same configuration as socket-server.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixMissingTaskAssignees() {
  console.log('🔧 Fixing missing task assignees...\n');
  
  let client;
  try {
    // Connect to database
    client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Find tasks where the creator is not assigned
    const missingAssigneesQuery = `
      SELECT t.id, t.user_id, t.title, t.created_at
      FROM tasks t
      WHERE t.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = t.user_id
      )
      ORDER BY t.id
    `;
    
    const missingResult = await client.query(missingAssigneesQuery);
    
    if (missingResult.rows.length === 0) {
      console.log('✅ All tasks already have their creators as assignees');
      return;
    }
    
    console.log(`📋 Found ${missingResult.rows.length} tasks with missing creator assignments:`);
    missingResult.rows.forEach(row => {
      console.log(`  - Task ${row.id}: "${row.title}" (created by user ${row.user_id})`);
    });
    
    // Add missing assignee relationships
    let fixedCount = 0;
    for (const task of missingResult.rows) {
      try {
        await client.query(
          'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)',
          [task.id, task.user_id]
        );
        console.log(`✅ Added assignee for task ${task.id} (user ${task.user_id})`);
        fixedCount++;
      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`⚠️  Task ${task.id} already has assignee ${task.user_id} (duplicate found)`);
        } else {
          console.error(`❌ Error adding assignee for task ${task.id}:`, error.message);
        }
      }
    }
    
    console.log(`\n🎉 Successfully fixed ${fixedCount} missing task assignee relationships`);
    
    // Verify the fix
    const verifyQuery = `
      SELECT COUNT(*) as remaining_missing
      FROM tasks t
      WHERE t.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM task_assignees ta 
        WHERE ta.task_id = t.id AND ta.user_id = t.user_id
      )
    `;
    
    const verifyResult = await client.query(verifyQuery);
    const remainingMissing = parseInt(verifyResult.rows[0].remaining_missing);
    
    if (remainingMissing === 0) {
      console.log('✅ Verification passed: All tasks now have their creators as assignees');
    } else {
      console.log(`⚠️  Warning: ${remainingMissing} tasks still missing creator assignments`);
    }
    
    // Show current task_assignees data
    console.log('\n📊 Current task_assignees data:');
    const currentAssignees = await client.query(`
      SELECT ta.task_id, ta.user_id, t.title, t.user_id as creator_id
      FROM task_assignees ta
      JOIN tasks t ON t.id = ta.task_id
      WHERE t.status = 'active'
      ORDER BY ta.task_id, ta.user_id
    `);
    
    currentAssignees.rows.forEach(row => {
      const isCreator = row.user_id === row.creator_id;
      console.log(`  ${row.task_id}\t${row.user_id}\t${isCreator ? '(creator)' : ''}\t"${row.title}"`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing task assignees:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the fix
fixMissingTaskAssignees().catch(console.error);
