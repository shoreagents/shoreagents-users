const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testApiMoveTask() {
  try {
    console.log('🧪 TESTING API MOVE_TASK ENDPOINT\n');

    // Find a task that User 2 is assigned to
    const taskResult = await pool.query(`
      SELECT 
        t.id, t.title, t.group_id, t.user_id as creator_id, tg.title as group_title
      FROM tasks t
      JOIN task_groups tg ON t.group_id = tg.id
      WHERE t.status = 'active'
        AND EXISTS(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = 2)
      LIMIT 1
    `);

    if (taskResult.rows.length === 0) {
      console.log('❌ No assigned tasks found for User 2');
      return;
    }

    const testTask = taskResult.rows[0];
    console.log(`📝 Testing with task ${testTask.id}: "${testTask.title}"`);
    console.log(`   Current group: "${testTask.group_title}" (ID: ${testTask.group_id})`);

    // Get target group
    const targetGroupResult = await pool.query(`
      SELECT id, title FROM task_groups 
      WHERE id != $1 
      ORDER BY position 
      LIMIT 1
    `, [testTask.group_id]);

    const targetGroup = targetGroupResult.rows[0];
    console.log(`   Target group: "${targetGroup.title}" (ID: ${targetGroup.id})`);

    // Get User 2's email for the API call
    const userResult = await pool.query(`
      SELECT email FROM users WHERE id = 2
    `);

    if (userResult.rows.length === 0) {
      console.log('❌ User 2 not found');
      return;
    }

    const userEmail = userResult.rows[0].email;
    console.log(`   User 2 email: ${userEmail}`);

    // Test the API endpoint directly
    console.log(`\n🔄 CALLING API ENDPOINT:`);
    const apiUrl = `http://localhost:3000/api/task-activity?email=${encodeURIComponent(userEmail)}`;
    const requestBody = {
      action: 'move_task',
      data: {
        task_id: testTask.id,
        new_group_id: targetGroup.id,
        target_position: 1
      }
    };

    console.log(`   URL: ${apiUrl}`);
    console.log(`   Body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`   Response status: ${response.status}`);
      
      const responseData = await response.json();
      console.log(`   Response data:`, JSON.stringify(responseData, null, 2));

      if (responseData.success) {
        console.log(`✅ API CALL SUCCESSFUL!`);
        console.log(`   Task moved successfully`);
        
        // Verify the move in database
        const verifyResult = await pool.query(`
          SELECT t.id, t.title, t.group_id, tg.title as group_title
          FROM tasks t
          JOIN task_groups tg ON t.group_id = tg.id
          WHERE t.id = $1
        `, [testTask.id]);
        
        if (verifyResult.rows.length > 0) {
          const updatedTask = verifyResult.rows[0];
          console.log(`   ✓ Database shows task in group: "${updatedTask.group_title}" (ID: ${updatedTask.group_id})`);
        }
      } else {
        console.log(`❌ API CALL FAILED:`);
        console.log(`   Error: ${responseData.error || 'Unknown error'}`);
      }

    } catch (fetchError) {
      console.log(`❌ FETCH ERROR: ${fetchError.message}`);
      console.log(`   This might be because the Next.js server is not running`);
      console.log(`   Try: npm run dev`);
    }

    console.log(`\n💡 DEBUGGING TIPS:`);
    console.log(`   1. Make sure Next.js server is running (npm run dev)`);
    console.log(`   2. Check browser Network tab for the actual API request/response`);
    console.log(`   3. Check browser Console for JavaScript errors`);
    console.log(`   4. Look for server-side console.log messages in the Next.js terminal`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testApiMoveTask();
