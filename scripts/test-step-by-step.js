const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testStepByStep() {
  try {
    console.log('🧪 Testing check_break_reminders step by step...\n');
    
    // Step 1: Check if User 2 exists in the query
    console.log('📋 Step 1: Check if User 2 is in the agent query...');
    const agentQuery = await pool.query(`
      SELECT DISTINCT u.id as user_id, u.user_type, u.email
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      WHERE u.user_type = 'Agent'
      ORDER BY u.id
    `);
    
    console.log('   Agents found:');
    agentQuery.rows.forEach(agent => {
      console.log(`     User ID: ${agent.user_id}, Type: ${agent.user_type}, Email: ${agent.email}`);
    });
    
    // Step 2: Check User 2's shift period
    console.log('\n📋 Step 2: Check User 2 shift period...');
    const shiftResult = await pool.query(`
      SELECT j.shift_period, j.shift_time
      FROM job_info j
      WHERE j.agent_user_id = 2
    `);
    
    if (shiftResult.rows.length > 0) {
      console.log(`   Shift Period: ${shiftResult.rows[0].shift_period}`);
      console.log(`   Shift Time: ${shiftResult.rows[0].shift_time}`);
    } else {
      console.log('   ❌ No shift info found');
    }
    
    // Step 3: Test the missed break function at 10:30 AM
    console.log('\n📋 Step 3: Test missed break at 10:30 AM...');
    const testTime = '2025-08-19 10:30:00';
    const missedResult = await pool.query(`
      SELECT is_break_missed(2, 'Lunch', $1::timestamp) as lunch_missed
    `, [testTime]);
    
    console.log(`   Lunch break missed at 10:30 AM: ${missedResult.rows[0].lunch_missed}`);
    
    // Step 4: Check if there are any existing notifications for User 2 today
    console.log('\n📋 Step 4: Check existing notifications for User 2 today...');
    const existingNotifications = await pool.query(`
      SELECT title, message, created_at
      FROM notifications
      WHERE user_id = 2
      AND DATE(created_at) = CURRENT_DATE
      ORDER BY created_at
    `);
    
    console.log(`   Notifications today: ${existingNotifications.rows.length}`);
    existingNotifications.rows.forEach((notification, index) => {
      console.log(`     ${index + 1}. ${notification.title}: ${notification.message} at ${notification.created_at}`);
    });
    
    // Step 5: Run check_break_reminders and see what happens
    console.log('\n📋 Step 5: Run check_break_reminders...');
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    console.log(`   Function returned: ${reminderResult.rows[0].check_break_reminders}`);
    
    // Step 6: Check if any new notifications were created
    console.log('\n📋 Step 6: Check for new notifications...');
    const newNotifications = await pool.query(`
      SELECT title, message, created_at
      FROM notifications
      WHERE user_id = 2
      AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
    `);
    
    console.log(`   New notifications (last 2 minutes): ${newNotifications.rows.length}`);
    newNotifications.rows.forEach((notification, index) => {
      console.log(`     ${index + 1}. ${notification.title}: ${notification.message} at ${notification.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testStepByStep();
