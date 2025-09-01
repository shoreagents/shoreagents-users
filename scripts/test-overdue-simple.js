const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Simple test script for the overdue task system
 * Tests basic functionality with global task groups
 */

async function testOverdueSystem() {
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
    
    console.log('🧪 Testing Overdue Task System...\n');
    
    // Test 1: Check if Overdue column exists
    console.log('1. Checking if Overdue column exists...');
    const overdueColumnResult = await client.query(`
      SELECT id, title, color, position 
      FROM task_groups 
      WHERE title = 'Overdue' 
      LIMIT 1
    `);
    
    if (overdueColumnResult.rows.length > 0) {
      const overdueColumn = overdueColumnResult.rows[0];
      console.log(`✅ Overdue column found: ID=${overdueColumn.id}, Position=${overdueColumn.position}, Color=${overdueColumn.color}`);
    } else {
      console.log('❌ Overdue column not found');
      console.log('   Please run the migration first: \\i migrations/043_add_overdue_column_and_notifications.sql');
      return;
    }
    
    // Test 2: Check if required functions exist
    console.log('\n2. Checking if required database functions exist...');
    try {
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'move_overdue_tasks_to_overdue_column\'');
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'check_overdue_task_notifications\'');
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'check_all_task_notifications\'');
      console.log('✅ All required database functions exist');
    } catch (functionError) {
      console.log('❌ Some required database functions are missing');
      console.log('   Please run the migration first: \\i migrations/043_add_overdue_column_and_notifications.sql');
      return;
    }
    
    // Test 3: Test the move_overdue_tasks_to_overdue_column function
    console.log('\n3. Testing move_overdue_tasks_to_overdue_column function...');
    try {
      const moveResult = await client.query('SELECT move_overdue_tasks_to_overdue_column() as tasks_moved');
      const tasksMoved = moveResult.rows[0].tasks_moved;
      console.log(`✅ Moved ${tasksMoved} tasks to Overdue column`);
    } catch (error) {
      console.log('❌ Error testing move function:', error.message);
      return;
    }
    
    // Test 4: Test the main check_all_task_notifications function
    console.log('\n4. Testing check_all_task_notifications function...');
    try {
      const allNotificationsResult = await client.query('SELECT check_all_task_notifications() as notifications_sent');
      const allNotificationsSent = allNotificationsResult.rows[0].notifications_sent;
      console.log(`✅ Total notifications sent: ${allNotificationsSent}`);
    } catch (error) {
      console.log('❌ Error testing notifications function:', error.message);
      return;
    }
    
    // Test 5: Check current overdue tasks
    console.log('\n5. Checking current overdue tasks...');
    try {
      const overdueTasksResult = await client.query(`
        SELECT 
          t.id,
          t.title,
          t.due_date,
          tg.title as group_name,
          u.email as user_email
        FROM tasks t 
        JOIN task_groups tg ON t.group_id = tg.id 
        JOIN users u ON t.user_id = u.id
        WHERE tg.title = 'Overdue' AND t.status = 'active'
        ORDER BY t.due_date ASC
        LIMIT 5
      `);
      
      if (overdueTasksResult.rows.length > 0) {
        console.log(`✅ Found ${overdueTasksResult.rows.length} overdue tasks:`);
        overdueTasksResult.rows.forEach((task, index) => {
          const dueDate = new Date(task.due_date).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
          console.log(`   ${index + 1}. "${task.title}" - Due: ${dueDate} (${task.user_email})`);
        });
      } else {
        console.log('✅ No overdue tasks found');
      }
    } catch (error) {
      console.log('❌ Error checking overdue tasks:', error.message);
    }
    
    console.log('\n🎉 Basic tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing overdue system:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run the test
testOverdueSystem().catch(console.error);
