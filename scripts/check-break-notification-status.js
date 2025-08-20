const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkBreakNotificationStatus() {
  try {
    console.log('🔍 Checking Break Notification Status...\n');
    
    // 1. Check if the check_break_reminders function exists and works
    console.log('1️⃣ Testing check_break_reminders function:');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      console.log(`   ✅ Function exists and returned: ${result.rows[0].check_break_reminders}`);
    } catch (error) {
      console.log(`   ❌ Function error: ${error.message}`);
    }
    
    // 2. Check current time and what notifications should be sent
    console.log('\n2️⃣ Current time analysis:');
    const now = new Date();
    console.log(`   Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`   Current hour: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    // 3. Check what agents exist and their shift info
    console.log('\n3️⃣ Agent and shift information:');
    const agentsResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        j.shift_period,
        j.shift_time,
        a.member_id
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN job_info j ON j.agent_user_id = u.id
      WHERE u.user_type = 'Agent'
      ORDER BY u.id
    `);
    
    console.log(`   Found ${agentsResult.rows.length} agents:`);
    agentsResult.rows.forEach((agent, index) => {
      console.log(`   ${index + 1}. ${agent.email} - Shift: ${agent.shift_period || 'Not set'} (${agent.shift_time || 'Default'})`);
    });
    
    // 4. Test individual notification functions for a specific agent
    if (agentsResult.rows.length > 0) {
      const testAgentId = agentsResult.rows[0].id;
      console.log(`\n4️⃣ Testing notification functions for agent ${testAgentId}:`);
      
      // Test available soon
      try {
        const availableSoonResult = await pool.query(`
          SELECT 
            is_break_available_soon($1, 'Morning', NOW() AT TIME ZONE 'Asia/Manila') as morning_available_soon,
            is_break_available_soon($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available_soon,
            is_break_available_soon($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') as afternoon_available_soon
        `, [testAgentId]);
        console.log('   Available soon results:', availableSoonResult.rows[0]);
      } catch (error) {
        console.log(`   ❌ Available soon error: ${error.message}`);
      }
      
      // Test break available
      try {
        const availableResult = await pool.query(`
          SELECT 
            is_break_available($1, 'Morning', NOW() AT TIME ZONE 'Asia/Manila') as morning_available,
            is_break_available($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available,
            is_break_available($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') as afternoon_available
        `, [testAgentId]);
        console.log('   Break available results:', availableResult.rows[0]);
      } catch (error) {
        console.log(`   ❌ Break available error: ${error.message}`);
      }
      
      // Test missed break
      try {
        const missedResult = await pool.query(`
          SELECT 
            is_break_missed($1, 'Morning', NOW() AT TIME ZONE 'Asia/Manila') as morning_missed,
            is_break_missed($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_missed,
            is_break_missed($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') as afternoon_missed
        `, [testAgentId]);
        console.log('   Missed break results:', missedResult.rows[0]);
      } catch (error) {
        console.log(`   ❌ Missed break error: ${error.message}`);
      }
    }
    
    // 5. Check recent notifications
    console.log('\n5️⃣ Recent notifications:');
    const notificationsResult = await pool.query(`
      SELECT 
        id,
        user_id,
        category,
        type,
        title,
        message,
        created_at
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (notificationsResult.rows.length > 0) {
      console.log(`   Found ${notificationsResult.rows.length} recent break notifications:`);
      notificationsResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title} - ${notification.message}`);
      });
    } else {
      console.log('   ❌ No recent break notifications found');
    }
    
    // 6. Check if notifications are being created but not delivered
    console.log('\n6️⃣ Checking notification delivery:');
    const totalNotificationsResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '24 hours'
    `);
    console.log(`   Total break notifications in last 24 hours: ${totalNotificationsResult.rows[0].total}`);
    
    // 7. Check socket server status
    console.log('\n7️⃣ Socket server status:');
    console.log('   Socket server should be running on port 3001');
    console.log('   Check if frontend is connected to socket server');
    
    console.log('\n✅ Break notification status check completed!');
    
  } catch (error) {
    console.error('❌ Error checking break notification status:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkBreakNotificationStatus();
