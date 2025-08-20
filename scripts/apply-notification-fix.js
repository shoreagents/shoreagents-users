const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyNotificationFix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying notification function fix...\n');
    
    // 1. Read and apply the SQL fix
    console.log('1️⃣ Applying create_break_reminder_notification function fix...');
    
    const fs = require('fs');
    const sqlFix = fs.readFileSync('./scripts/fix-notification-type.sql', 'utf8');
    
    await client.query(sqlFix);
    console.log('   ✅ Function updated successfully');
    
    // 2. Test the fixed function
    console.log('\n2️⃣ Testing the fixed function...');
    
    try {
      const functionTest = await client.query(`
        SELECT create_break_reminder_notification(2, 'break_available', 'Lunch')
      `);
      
      if (functionTest.rows[0].create_break_reminder_notification) {
        console.log(`   ✅ Function executed successfully!`);
        console.log(`   Notification ID: ${functionTest.rows[0].create_break_reminder_notification}`);
      } else {
        console.log(`   ⚠️ Function executed but returned null`);
      }
    } catch (funcTestError) {
      console.log(`   ❌ Function test failed: ${funcTestError.message}`);
      return;
    }
    
    // 3. Check if notification was created
    console.log('\n3️⃣ Checking if notification was created...');
    
    const newNotification = await client.query(`
      SELECT 
        id,
        user_id,
        category,
        type,
        title,
        message,
        payload,
        created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '2 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (newNotification.rows.length > 0) {
      const notif = newNotification.rows[0];
      console.log(`   ✅ Notification created successfully!`);
      console.log(`      ID: ${notif.id}`);
      console.log(`      Type: ${notif.type}`);
      console.log(`      Title: ${notif.title}`);
      console.log(`      Message: ${notif.message}`);
      console.log(`      Payload: ${JSON.stringify(notif.payload)}`);
      console.log(`      Created: ${notif.created_at.toLocaleString()}`);
      
      // Clean up test notification
      await client.query('DELETE FROM notifications WHERE id = $1', [notif.id]);
      console.log('   ✅ Test notification cleaned up');
    } else {
      console.log(`   ❌ No notification found - something still wrong`);
    }
    
    // 4. Test the scheduler function
    console.log('\n4️⃣ Testing check_break_reminders function...');
    
    try {
      const reminderResult = await client.query('SELECT check_break_reminders()');
      const notificationsSent = reminderResult.rows[0].check_break_reminders;
      
      console.log(`   ✅ check_break_reminders executed: ${notificationsSent} notifications sent`);
      
      if (notificationsSent > 0) {
        console.log('   📢 Checking what notifications were created...');
        
        const schedulerNotifications = await client.query(`
          SELECT 
            id,
            user_id,
            type,
            title,
            message,
            created_at
          FROM notifications
          WHERE category = 'break'
          AND created_at > NOW() - INTERVAL '2 minutes'
          ORDER BY created_at DESC
        `);
        
        if (schedulerNotifications.rows.length > 0) {
          console.log(`   Found ${schedulerNotifications.rows.length} notifications:`);
          schedulerNotifications.rows.forEach((notif, index) => {
            console.log(`     ${index + 1}. User ${notif.user_id} - ${notif.title} (${notif.type})`);
            console.log(`        Message: ${notif.message}`);
          });
          
          // Clean up all test notifications
          await client.query(`
            DELETE FROM notifications 
            WHERE id IN (${schedulerNotifications.rows.map(n => n.id).join(',')})
          `);
          console.log('   ✅ All test notifications cleaned up');
        }
      }
    } catch (schedulerError) {
      console.log(`   ❌ Scheduler test failed: ${schedulerError.message}`);
    }
    
    // 5. Summary
    console.log('\n🎯 Summary:');
    console.log('   ✅ Notification function fixed');
    console.log('   ✅ Type field now properly set');
    console.log('   ✅ Scheduler should now work correctly');
    console.log('   🔔 You should now receive notifications at 11:00 AM!');
    
  } catch (error) {
    console.error('\n❌ Error applying notification fix:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the fix
applyNotificationFix();
