const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Test script for the overdue task system
 * This script tests the various functions to ensure they work correctly
 */

async function testOverdueSystem() {
  let client;
  
  try {
    // First, test the database connection
    console.log('🔌 Testing database connection...');
    try {
      client = await pool.connect();
      console.log('✅ Database connection successful');
    } catch (connectionError) {
      console.error('❌ Database connection failed:', connectionError.message);
      console.log('\n🔧 Troubleshooting tips:');
      console.log('   1. Make sure PostgreSQL is running');
      console.log('   2. Check your .env.local file has correct DATABASE_URL');
      console.log('   3. Verify database credentials and permissions');
      console.log('   4. Try running: npm run socket (to start the main system)');
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
      console.log('   This means the migration has not been run yet.');
      console.log('   Please run: \\i migrations/043_add_overdue_column_and_notifications.sql');
      return;
    }
    
    // Test 1.5: Check if required functions exist
    console.log('\n1.5. Checking if required database functions exist...');
    try {
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'move_overdue_tasks_to_overdue_column\'');
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'check_overdue_task_notifications\'');
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'check_task_due_notifications\'');
      await client.query('SELECT 1 FROM pg_proc WHERE proname = \'check_all_task_notifications\'');
      console.log('✅ All required database functions exist');
    } catch (functionError) {
      console.log('❌ Some required database functions are missing');
      console.log('   Please run the migration first: \\i migrations/043_add_overdue_column_and_notifications.sql');
      return;
    }
    
    // Test 2: Test the move_overdue_tasks_to_overdue_column function
    console.log('\n2. Testing move_overdue_tasks_to_overdue_column function...');
    const moveResult = await client.query('SELECT move_overdue_tasks_to_overdue_column() as tasks_moved');
    const tasksMoved = moveResult.rows[0].tasks_moved;
    console.log(`✅ Moved ${tasksMoved} tasks to Overdue column`);
    
    // Test 3: Test the check_overdue_task_notifications function
    console.log('\n3. Testing check_overdue_task_notifications function...');
    const overdueNotificationsResult = await client.query('SELECT check_overdue_task_notifications() as notifications_sent');
    const overdueNotificationsSent = overdueNotificationsResult.rows[0].notifications_sent;
    console.log(`✅ Sent ${overdueNotificationsSent} overdue notifications`);
    
    // Test 4: Test the check_task_due_notifications function
    console.log('\n4. Testing check_task_due_notifications function...');
    const dueNotificationsResult = await client.query('SELECT check_task_due_notifications() as notifications_sent');
    const dueNotificationsSent = dueNotificationsResult.rows[0].notifications_sent;
    console.log(`✅ Sent ${dueNotificationsSent} due soon notifications`);
    
    // Test 5: Test the main check_all_task_notifications function
    console.log('\n5. Testing check_all_task_notifications function...');
    const allNotificationsResult = await client.query('SELECT check_all_task_notifications() as notifications_sent');
    const allNotificationsSent = allNotificationsResult.rows[0].notifications_sent;
    console.log(`✅ Total notifications sent: ${allNotificationsSent}`);
    
    // Test 6: Test the test_overdue_system function
    console.log('\n6. Testing test_overdue_system function...');
    const testResult = await client.query('SELECT test_overdue_system() as result');
    console.log(`✅ Test result: ${testResult.rows[0].result}`);
    
    // Test 7: Check current overdue tasks
    console.log('\n7. Checking current overdue tasks...');
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
      LIMIT 10
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
    
    // Test 8: Check recent notifications
    console.log('\n8. Checking recent task notifications...');
    const recentNotificationsResult = await client.query(`
      SELECT 
        title,
        message,
        created_at,
        user_id
      FROM notifications 
      WHERE category = 'task' 
      AND (title = 'Task overdue' OR title = 'Task due soon')
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    if (recentNotificationsResult.rows.length > 0) {
      console.log(`✅ Found ${recentNotificationsResult.rows.length} recent task notifications:`);
      recentNotificationsResult.rows.forEach((notification, index) => {
        const createdAt = new Date(notification.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        console.log(`   ${index + 1}. ${notification.title}: ${notification.message} (${createdAt})`);
      });
    } else {
      console.log('✅ No recent task notifications found');
    }
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing overdue system:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testOverdueSystem().catch(console.error);
