const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testSchedulerManually() {
  try {
    console.log('🧪 Manually Testing Break Reminder Scheduler...\n');
    
    // 1. Check current time and what should happen
    const now = new Date();
    console.log(`🕐 Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`   Hour: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    
    // 2. Test the check_break_reminders function manually
    console.log('\n2️⃣ Manually calling check_break_reminders():');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      console.log(`   ✅ Function executed successfully`);
      console.log(`   📊 Notifications sent: ${notificationsSent}`);
      
      if (notificationsSent > 0) {
        console.log(`   🎉 Successfully sent ${notificationsSent} notifications!`);
      } else {
        console.log(`   ℹ️ No notifications were sent (this might be normal)`);
      }
    } catch (error) {
      console.log(`   ❌ Function failed: ${error.message}`);
    }
    
    // 3. Check what notifications were just created
    console.log('\n3️⃣ Checking for newly created notifications:');
    const newNotificationsResult = await pool.query(`
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
      AND created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
    `);
    
    if (newNotificationsResult.rows.length > 0) {
      console.log(`   📢 Found ${newNotificationsResult.rows.length} new notifications:`);
      newNotificationsResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
        console.log(`      User ID: ${notification.user_id}, Type: ${notification.type}`);
        console.log(`      Message: ${notification.message}`);
      });
    } else {
      console.log(`   ❌ No new notifications found in the last 5 minutes`);
    }
    
    // 4. Test individual agent notification functions
    console.log('\n4️⃣ Testing individual agent notification functions:');
    
    // Get agent with Day Shift (should have lunch break at 10 AM - 1 PM)
    const dayShiftAgentResult = await pool.query(`
      SELECT u.id, u.email, j.shift_time
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN job_info j ON j.agent_user_id = u.id
      WHERE u.user_type = 'Agent'
      AND (j.shift_period = 'Day Shift' OR j.shift_period IS NULL)
      LIMIT 1
    `);
    
    if (dayShiftAgentResult.rows.length > 0) {
      const agent = dayShiftAgentResult.rows[0];
      console.log(`   Testing agent: ${agent.email} (ID: ${agent.id})`);
      console.log(`   Shift time: ${agent.shift_time || 'Default (6:00 AM - 3:00 PM)'}`);
      
      // Test lunch break specifically (should be available at 10 AM - 1 PM)
      try {
        const lunchTestResult = await pool.query(`
          SELECT 
            is_break_available_soon($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available_soon,
            is_break_available($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available,
            is_break_missed($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_missed
        `, [agent.id]);
        
        console.log('   Lunch break test results:');
        console.log(`     Available soon: ${lunchTestResult.rows[0].lunch_available_soon}`);
        console.log(`     Available now: ${lunchTestResult.rows[0].lunch_available}`);
        console.log(`     Missed: ${lunchTestResult.rows[0].lunch_missed}`);
        
        // If lunch should be available soon or available now, let's test creating a notification
        if (lunchTestResult.rows[0].lunch_available_soon || lunchTestResult.rows[0].lunch_available) {
          console.log('\n   🧪 Testing notification creation for this agent:');
          
          if (lunchTestResult.rows[0].lunch_available_soon) {
            const notificationResult = await pool.query(`
              SELECT create_break_reminder_notification($1, 'available_soon', 'Lunch')
            `, [agent.id]);
            console.log('     ✅ Created "available soon" notification');
          }
          
          if (lunchTestResult.rows[0].lunch_available) {
            const notificationResult = await pool.query(`
              SELECT create_break_reminder_notification($1, 'break_available', 'Lunch')
            `, [agent.id]);
            console.log('     ✅ Created "break available" notification');
          }
          
          // Check if notifications were created
          const testNotificationsResult = await pool.query(`
            SELECT COUNT(*) as count
            FROM notifications
            WHERE user_id = $1
            AND category = 'break'
            AND created_at > NOW() - INTERVAL '1 minute'
          `, [agent.id]);
          
          console.log(`     📊 Test notifications created: ${testNotificationsResult.rows[0].count}`);
        }
        
      } catch (error) {
        console.log(`   ❌ Lunch test error: ${error.message}`);
      }
    }
    
    // 5. Check if the issue is with the scheduler timing
    console.log('\n5️⃣ Scheduler timing analysis:');
    console.log('   The scheduler should run every 2 minutes');
    console.log('   Current time should trigger lunch break notifications (10 AM - 1 PM)');
    console.log('   If no notifications are being created, the scheduler might not be running');
    
    console.log('\n✅ Manual scheduler test completed!');
    
  } catch (error) {
    console.error('❌ Error in manual scheduler test:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testSchedulerManually();
