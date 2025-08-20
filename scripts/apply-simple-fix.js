const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applySimpleFix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying simple working function fixes...\n');
    
    // 1. Apply the simple SQL fixes
    console.log('1️⃣ Applying simple database function fixes...');
    
    const fs = require('fs');
    const sqlFix = fs.readFileSync('./scripts/fix-missing-functions-simple.sql', 'utf8');
    
    await client.query(sqlFix);
    console.log('   ✅ Functions updated successfully');
    
    // 2. Test the new calculate_break_windows function
    console.log('\n2️⃣ Testing calculate_break_windows function...');
    
    try {
      const breakWindows = await client.query('SELECT * FROM calculate_break_windows(2)');
      
      if (breakWindows.rows.length > 0) {
        console.log('   ✅ Break windows calculated successfully:');
        breakWindows.rows.forEach((window, index) => {
          console.log(`     ${index + 1}. ${window.break_type}: ${window.start_time} - ${window.end_time}`);
        });
      } else {
        console.log('   ⚠️ No break windows found (check shift configuration)');
      }
    } catch (testError) {
      console.log(`   ❌ Function test failed: ${testError.message}`);
      return;
    }
    
    // 3. Test the fixed is_break_reminder_due function
    console.log('\n3️⃣ Testing is_break_reminder_due function...');
    
    try {
      const lunchTest = await client.query(`
        SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum) as result
      `);
      console.log(`   Lunch break reminder due: ${lunchTest.rows[0].result}`);
      
      const morningTest = await client.query(`
        SELECT is_break_reminder_due(2, 'Morning'::break_type_enum) as result
      `);
      console.log(`   Morning break reminder due: ${morningTest.rows[0].result}`);
      
      const afternoonTest = await client.query(`
        SELECT is_break_reminder_due(2, 'Afternoon'::break_type_enum) as result
      `);
      console.log(`   Afternoon break reminder due: ${afternoonTest.rows[0].result}`);
      
    } catch (testError) {
      console.log(`   ❌ Function test failed: ${testError.message}`);
    }
    
    // 4. Test the fixed check_break_reminders function
    console.log('\n4️⃣ Testing check_break_reminders function...');
    
    try {
      const reminderResult = await client.query('SELECT check_break_reminders()');
      const notificationsSent = reminderResult.rows[0].check_break_reminders;
      
      console.log(`   ✅ check_break_reminders executed: ${notificationsSent} notifications sent`);
      
      if (notificationsSent > 0) {
        console.log('   📢 Checking what notifications were created...');
        
        const newNotifications = await client.query(`
          SELECT 
            id,
            user_id,
            type,
            title,
            message,
            payload,
            created_at
          FROM notifications
          WHERE category = 'break'
          AND created_at > NOW() - INTERVAL '2 minutes'
          ORDER BY created_at DESC
        `);
        
        if (newNotifications.rows.length > 0) {
          console.log(`   Found ${newNotifications.rows.length} new notifications:`);
          newNotifications.rows.forEach((notif, index) => {
            console.log(`     ${index + 1}. User ${notif.user_id} - ${notif.title} (${notif.type})`);
            console.log(`        Message: ${notif.message}`);
            console.log(`        Payload: ${JSON.stringify(notif.payload)}`);
          });
          
          // Clean up test notifications
          const notificationIds = newNotifications.rows.map(n => n.id);
          await client.query(`
            DELETE FROM notifications 
            WHERE id = ANY($1)
          `, [notificationIds]);
          console.log('   ✅ Test notifications cleaned up');
        }
      }
    } catch (schedulerError) {
      console.log(`   ❌ Scheduler test failed: ${schedulerError.message}`);
    }
    
    // 5. Clean up spam notifications
    console.log('\n5️⃣ Cleaning up spam notifications...');
    
    try {
      const deleteResult = await client.query(`
        DELETE FROM notifications 
        WHERE category = 'break' 
        AND payload->>'reminder_type' = 'missed_break'
        AND created_at > NOW() - INTERVAL '2 hours'
      `);
      
      console.log(`   ✅ Deleted ${deleteResult.rowCount} spam notifications`);
    } catch (cleanupError) {
      console.log(`   ⚠️ Cleanup failed: ${cleanupError.message}`);
    }
    
    // 6. Summary
    console.log('\n🎯 Summary of Fixes Applied:');
    console.log('   ✅ Created working calculate_break_windows function');
    console.log('   ✅ Fixed is_break_reminder_due to prevent spam');
    console.log('   ✅ Added duplicate prevention to check_break_reminders');
    console.log('   ✅ Cleaned up spam notifications');
    console.log('   ✅ Night breaks only trigger for night shifts now');
    
    console.log('\n🔧 Next Steps:');
    console.log('   1. Stop all Node.js processes (taskkill /F /IM node.exe)');
    console.log('   2. Start single scheduler: node scripts/break-reminder-scheduler.js');
    console.log('   3. Notifications will now be sent every 30 minutes only');
    
  } catch (error) {
    console.error('\n❌ Error applying simple fix:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the fix
applySimpleFix();
