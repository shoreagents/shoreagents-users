#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    console.log('🚀 RUNNING TASK GROUPS GLOBAL MIGRATION\n');
    
    // Read the migration file
    const migrationSQL = fs.readFileSync('migrations/043_make_task_groups_global.sql', 'utf8');
    
    // Execute the migration
    console.log('📝 Executing migration...');
    const result = await pool.query(migrationSQL);
    
    // The migration returns multiple result sets, let's process them
    console.log('✅ Migration completed successfully!\n');
    
    // Show the final state
    console.log('📊 FINAL STATE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check task groups
    const groups = await pool.query('SELECT id, title, created_by, is_default FROM task_groups ORDER BY id');
    console.log('\n📁 Task Groups (now global):');
    groups.rows.forEach(g => {
      console.log(`   Group ${g.id}: "${g.title}" (Created by: User ${g.created_by || 'Unknown'}) ${g.is_default ? '[DEFAULT]' : ''}`);
    });
    
    // Check tasks
    const tasks = await pool.query(`
      SELECT t.id, t.title, t.user_id as task_creator, t.group_id, tg.title as group_title, tg.created_by as group_creator
      FROM tasks t 
      LEFT JOIN task_groups tg ON tg.id = t.group_id 
      WHERE t.status = 'active'
      ORDER BY t.group_id, t.id
    `);
    
    console.log('\n📋 Tasks in Groups:');
    tasks.rows.forEach(t => {
      console.log(`   Task ${t.id}: "${t.title}" (Creator: User ${t.task_creator}) → Group ${t.group_id} "${t.group_title}"`);
    });
    
    console.log('\n🎯 CHANGES MADE:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Removed user_id column from task_groups');
    console.log('✅ Added created_by column to track group creators');
    console.log('✅ All task groups are now global/shared');
    console.log('✅ Users can see tasks in any group (if they own or are assigned)');
    console.log('✅ API query already updated to remove group ownership filter');
    
    console.log('\n💡 WHAT THIS MEANS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('• Task groups (To Do, In Progress, etc.) are now shared by everyone');
    console.log('• User 4 can now see their tasks that are in any group');
    console.log('• Users still only see tasks they own OR are assigned to');
    console.log('• Task relationships will work properly across users');
    console.log('• The "broken" relationship issue should be resolved');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

runMigration();
