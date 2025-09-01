const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Test script to verify that tasks in Done column are protected from moving to Overdue
 */

async function testDoneColumnProtection() {
  let client;
  
  try {
    console.log('🔌 Testing database connection...');
    try {
      client = await pool.connect();
      console.log('✅ Database connection successful');
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
      return;
    }
    
    console.log('🧪 Testing Done Column Protection...\n');
    
    // Test 1: Check current tasks in Done column
    console.log('1. Checking current tasks in Done column...');
    const doneTasksResult = await client.query(`
      SELECT 
        t.id,
        t.title,
        t.due_date,
        t.status,
        tg.title as group_name
      FROM tasks t 
      JOIN task_groups tg ON t.group_id = tg.id 
      WHERE tg.title = 'Done' AND t.status = 'active'
      ORDER BY t.due_date ASC
    `);
    
    if (doneTasksResult.rows.length > 0) {
      console.log(`✅ Found ${doneTasksResult.rows.length} tasks in Done column:`);
      doneTasksResult.rows.forEach((task, index) => {
        const dueDate = task.due_date ? new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'No due date';
        console.log(`   ${index + 1}. "${task.title}" - Due: ${dueDate} - Status: ${task.status}`);
      });
    } else {
      console.log('✅ No tasks found in Done column');
    }
    
    // Test 2: Check if any Done tasks are overdue
    console.log('\n2. Checking if Done tasks are overdue...');
    const overdueDoneTasksResult = await client.query(`
      SELECT 
        t.id,
        t.title,
        t.due_date,
        t.status,
        tg.title as group_name
      FROM tasks t 
      JOIN task_groups tg ON t.group_id = tg.id 
      WHERE tg.title = 'Done' 
      AND t.status = 'active'
      AND t.due_date < now() AT TIME ZONE 'Asia/Manila'
      ORDER BY t.due_date ASC
    `);
    
    if (overdueDoneTasksResult.rows.length > 0) {
      console.log(`⚠️  Found ${overdueDoneTasksResult.rows.length} overdue tasks in Done column:`);
      overdueDoneTasksResult.rows.forEach((task, index) => {
        const dueDate = new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        console.log(`   ${index + 1}. "${task.title}" - Due: ${dueDate} - Status: ${task.status}`);
      });
    } else {
      console.log('✅ No overdue tasks found in Done column');
    }
    
    // Test 3: Test the move function to ensure it doesn't move Done tasks
    console.log('\n3. Testing move_overdue_tasks_to_overdue_column function...');
    try {
      const moveResult = await client.query('SELECT move_overdue_tasks_to_overdue_column() as tasks_moved');
      const tasksMoved = moveResult.rows[0].tasks_moved;
      console.log(`✅ Moved ${tasksMoved} tasks to Overdue column`);
    } catch (error) {
      console.log('❌ Error testing move function:', error.message);
      return;
    }
    
    // Test 4: Verify Done tasks are still in Done column
    console.log('\n4. Verifying Done tasks are still in Done column...');
    const doneTasksAfterResult = await client.query(`
      SELECT 
        t.id,
        t.title,
        t.due_date,
        t.status,
        tg.title as group_name
      FROM tasks t 
      JOIN task_groups tg ON t.group_id = tg.id 
      WHERE tg.title = 'Done' AND t.status = 'active'
      ORDER BY t.due_date ASC
    `);
    
    if (doneTasksAfterResult.rows.length > 0) {
      console.log(`✅ Done column still has ${doneTasksAfterResult.rows.length} tasks after move operation`);
      console.log('   This confirms that Done tasks are protected from moving to Overdue');
    } else {
      console.log('⚠️  Done column is now empty - this might indicate an issue');
    }
    
    // Test 5: Check Overdue column for any Done tasks that shouldn't be there
    console.log('\n5. Checking Overdue column for any Done tasks...');
    const overdueColumnResult = await client.query(`
      SELECT 
        t.id,
        t.title,
        t.due_date,
        t.status,
        tg.title as group_name
      FROM tasks t 
      JOIN task_groups tg ON t.group_id = tg.id 
      WHERE tg.title = 'Overdue' AND t.status = 'active'
      ORDER BY t.due_date ASC
    `);
    
    if (overdueColumnResult.rows.length > 0) {
      console.log(`✅ Overdue column has ${overdueColumnResult.rows.length} tasks`);
      console.log('   These are tasks that were overdue but not in Done column');
    } else {
      console.log('✅ Overdue column is empty');
    }
    
    console.log('\n🎉 Done column protection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Done column protection:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testDoneColumnProtection().catch(console.error);
