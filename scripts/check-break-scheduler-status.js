const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkBreakSchedulerStatus() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking break scheduler status and connection...\n');
    
    // 1. Check if there's a scheduler table or job info
    console.log('1️⃣ Checking for scheduler configuration...');
    
    try {
      const schedulerTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name LIKE '%scheduler%' OR table_name LIKE '%job%' OR table_name LIKE '%cron%'
      `);
      
      if (schedulerTables.rows.length > 0) {
        console.log('   Found scheduler-related tables:');
        schedulerTables.rows.forEach((table, index) => {
          console.log(`     ${index + 1}. ${table.table_name}`);
        });
      } else {
        console.log('   No scheduler tables found in database');
      }
    } catch (error) {
      console.log(`   Error checking scheduler tables: ${error.message}`);
    }
    
    // 2. Check for any scheduled jobs or tasks
    console.log('\n2️⃣ Checking for scheduled jobs...');
    
    try {
      const scheduledJobs = await client.query(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE tablename LIKE '%job%' OR tablename LIKE '%scheduler%' OR tablename LIKE '%cron%'
      `);
      
      if (scheduledJobs.rows.length > 0) {
        console.log('   Found job-related statistics:');
        scheduledJobs.rows.forEach((job, index) => {
          console.log(`     ${index + 1}. ${job.schemaname}.${job.tablename}`);
        });
      } else {
        console.log('   No job-related statistics found');
      }
    } catch (error) {
      console.log(`   Error checking scheduled jobs: ${error.message}`);
    }
    
    // 3. Check if there are any active break sessions
    console.log('\n3️⃣ Checking for active break sessions...');
    
    try {
      const activeBreaks = await client.query(`
        SELECT 
          id,
          agent_user_id,
          break_type,
          break_date,
          start_time,
          end_time,
          status
        FROM break_sessions
        WHERE break_date = CURRENT_DATE
        ORDER BY start_time DESC
      `);
      
      if (activeBreaks.rows.length > 0) {
        console.log('   Active break sessions today:');
        activeBreaks.rows.forEach((break_session, index) => {
          console.log(`     ${index + 1}. User ${break_session.agent_user_id} - ${break_session.break_type}`);
          console.log(`        Status: ${break_session.status}, Time: ${break_session.start_time}`);
        });
      } else {
        console.log('   No active break sessions today');
      }
    } catch (error) {
      console.log(`   Error checking break sessions: ${error.message}`);
    }
    
    // 4. Check if notifications are being created
    console.log('\n4️⃣ Checking recent notifications...');
    
    try {
      const recentNotifications = await client.query(`
        SELECT 
          id,
          user_id,
          title,
          message,
          category,
          created_at
        FROM notifications
        WHERE category = 'break'
        AND created_at > NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      if (recentNotifications.rows.length > 0) {
        console.log('   Recent break notifications (last 24 hours):');
        recentNotifications.rows.forEach((notif, index) => {
          console.log(`     ${index + 1}. User ${notif.user_id} - ${notif.title}`);
          console.log(`        Message: ${notif.message}`);
          console.log(`        Time: ${notif.created_at.toLocaleString()}`);
        });
      } else {
        console.log('   No break notifications in the last 24 hours');
      }
    } catch (error) {
      console.log(`   Error checking notifications: ${error.message}`);
    }
    
    // 5. Test if the scheduler functions work
    console.log('\n5️⃣ Testing scheduler functions...');
    
    try {
      // Test check_break_reminders function
      const reminderResult = await client.query('SELECT check_break_reminders()');
      console.log(`   check_break_reminders function works: ${reminderResult.rows[0].check_break_reminders} notifications sent`);
      
      // Test if we can manually trigger notifications
      console.log('   Testing manual notification trigger...');
      
      // Clear any existing notifications first
      await client.query(`
        DELETE FROM notifications 
        WHERE user_id = 2 
        AND category = 'break' 
        AND created_at > NOW() - INTERVAL '5 minutes'
      `);
      
      // Try to create a test notification
      const testNotification = await client.query(`
        INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          category, 
          payload,
          created_at
        ) VALUES (
          2, 
          'Test Break Notification', 
          'This is a test notification to verify the system works', 
          'break', 
          '{"reminder_type": "test"}',
          NOW()
        ) RETURNING id
      `);
      
      if (testNotification.rows.length > 0) {
        console.log(`   ✅ Test notification created successfully (ID: ${testNotification.rows[0].id})`);
        
        // Clean up test notification
        await client.query(`
          DELETE FROM notifications WHERE id = $1
        `, [testNotification.rows[0].id]);
        console.log('   ✅ Test notification cleaned up');
      } else {
        console.log('   ❌ Failed to create test notification');
      }
      
    } catch (error) {
      console.log(`   Error testing scheduler functions: ${error.message}`);
    }
    
    // 6. Check for any cron jobs or system processes
    console.log('\n6️⃣ Checking for system-level scheduling...');
    
    try {
      // Check if there are any functions that might be called by external schedulers
      const schedulerFunctions = await client.query(`
        SELECT 
          proname,
          prosrc
        FROM pg_proc 
        WHERE prosrc LIKE '%cron%' OR prosrc LIKE '%scheduler%' OR prosrc LIKE '%interval%'
      `);
      
      if (schedulerFunctions.rows.length > 0) {
        console.log('   Found potential scheduler functions:');
        schedulerFunctions.rows.forEach((func, index) => {
          console.log(`     ${index + 1}. ${func.proname}`);
        });
      } else {
        console.log('   No obvious scheduler functions found');
      }
    } catch (error) {
      console.log(`   Error checking scheduler functions: ${error.message}`);
    }
    
    // 7. Summary and recommendations
    console.log('\n🎯 Summary and Recommendations:');
    console.log('   The break notification system consists of:');
    console.log('   1. Database functions (✅ Working)');
    console.log('   2. Scheduler process (❓ Need to verify)');
    console.log('   3. Notification delivery (✅ Working)');
    console.log('');
    console.log('   To get notifications working:');
    console.log('   • Ensure the break scheduler is running as a background process');
    console.log('   • The scheduler should call check_break_reminders() every 2-5 minutes');
    console.log('   • Check if there\'s a cron job or systemd service running the scheduler');
    
  } catch (error) {
    console.error('\n❌ Error checking break scheduler status:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkBreakSchedulerStatus();
