// Simple test to call the move_task API and see the exact error
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testMoveTaskAPI() {
  try {
    console.log('🧪 TESTING MOVE_TASK API CALL\n');

    // Get User 2's email and a task they're assigned to
    const result = await pool.query(`
      SELECT 
        u.email,
        t.id as task_id,
        t.title,
        t.group_id as current_group_id,
        tg1.title as current_group_title,
        tg2.id as target_group_id,
        tg2.title as target_group_title
      FROM users u
      CROSS JOIN tasks t
      JOIN task_groups tg1 ON t.group_id = tg1.id
      JOIN task_groups tg2 ON tg2.id != t.group_id
      WHERE u.id = 2 
        AND t.status = 'active'
        AND EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2)
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No suitable test data found');
      return;
    }

    const testData = result.rows[0];
    console.log('📝 Test data:');
    console.log(`   User: ${testData.email}`);
    console.log(`   Task: ${testData.task_id} - "${testData.title}"`);
    console.log(`   From: "${testData.current_group_title}" (${testData.current_group_id})`);
    console.log(`   To: "${testData.target_group_title}" (${testData.target_group_id})`);

    // Simulate the exact API call that the frontend makes
    const requestBody = {
      action: 'move_task',
      data: {
        task_id: testData.task_id,
        new_group_id: testData.target_group_id,
        target_position: 1
      }
    };

    console.log('\n🔄 Making API call...');
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Make the API call (assuming Next.js is running on localhost:3000)
    try {
      const response = await fetch(`http://localhost:3000/api/task-activity?email=${encodeURIComponent(testData.email)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`\n📡 Response status: ${response.status}`);
      
      const responseData = await response.json();
      console.log('📄 Response body:', JSON.stringify(responseData, null, 2));

      if (responseData.success) {
        console.log('\n✅ SUCCESS: Task moved successfully!');
      } else {
        console.log('\n❌ FAILURE: API returned error');
        console.log(`Error: ${responseData.error}`);
      }

    } catch (fetchError) {
      console.log('\n❌ FETCH ERROR:', fetchError.message);
      console.log('💡 Make sure Next.js dev server is running: npm run dev');
    }

  } catch (error) {
    console.error('❌ Script error:', error.message);
  } finally {
    await pool.end();
  }
}

testMoveTaskAPI();
