const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkSchedulerStatus() {
  console.log('🔍 Checking Break Reminder Scheduler Status\n');
  
  try {
    // 1. Check if scheduler is running as a process
    console.log('1️⃣ System Process Check:');
    console.log('   • Checking if break-reminder-scheduler.js is running...');
    
    // 2. Check database for recent scheduler activity
    console.log('\n2️⃣ Database Scheduler Activity:');
    
    // Check recent notifications to see if scheduler is active
    const recentNotifications = await pool.query(`
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '10 minutes' THEN 1 END) as last_10_min,
        MIN(created_at) as earliest_notification,
        MAX(created_at) as latest_notification
      FROM notifications 
      WHERE category = 'break'
    `);
    
    const notifStats = recentNotifications.rows[0];
    console.log(`   • Total break notifications: ${notifStats.total_notifications}`);
    console.log(`   • Last hour: ${notifStats.last_hour}`);
    console.log(`   • Last 10 minutes: ${notifStats.last_10_min}`);
    console.log(`   • Earliest: ${notifStats.earliest_notification}`);
    console.log(`   • Latest: ${notifStats.latest_notification}`);
    
    // 3. Check for recent break reminder function calls
    console.log('\n3️⃣ Recent Break Reminder Function Calls:');
    const recentCalls = await pool.query(`
      SELECT 
        created_at,
        title,
        message,
        payload->>'reminder_type' as reminder_type,
        payload->>'break_type' as break_type
      FROM notifications 
      WHERE category = 'break' 
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentCalls.rows.length > 0) {
      console.log(`   • Found ${recentCalls.rows.length} recent break notifications:`);
      recentCalls.rows.forEach((notif, index) => {
        const time = new Date(notif.created_at).toLocaleTimeString();
        console.log(`     ${index + 1}. [${time}] ${notif.title}`);
        console.log(`        Type: ${notif.reminder_type}, Break: ${notif.break_type}`);
      });
    } else {
      console.log('   • No recent break notifications found');
    }
    
    // 4. Check if check_break_reminders function exists and is working
    console.log('\n4️⃣ Break Reminder Function Status:');
    const functionStatus = await pool.query(`
      SELECT 
        proname,
        prosrc IS NOT NULL as has_source,
        CASE WHEN prosrc LIKE '%check_break_reminders%' THEN 'CALLS_SCHEDULER' 
             WHEN prosrc LIKE '%scheduler%' THEN 'SCHEDULER_FUNCTION'
             ELSE 'OTHER' END as function_type
      FROM pg_proc 
      WHERE proname IN ('check_break_reminders', 'is_break_available_now', 'is_break_available_soon')
    `);
    
    if (functionStatus.rows.length > 0) {
      console.log(`   • Found ${functionStatus.rows.length} break-related functions:`);
      functionStatus.rows.forEach((func, index) => {
        console.log(`     ${index + 1}. ${func.proname} (${func.function_type})`);
      });
    } else {
      console.log('   • No break-related functions found');
    }
    
    // 5. Check for any cron jobs or scheduled tasks
    console.log('\n5️⃣ Database Scheduled Tasks:');
    const scheduledTasks = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE tablename LIKE '%cron%' OR tablename LIKE '%scheduler%' OR tablename LIKE '%job%'
    `);
    
    if (scheduledTasks.rows.length > 0) {
      console.log(`   • Found ${scheduledTasks.rows.length} scheduler-related tables:`);
      scheduledTasks.rows.forEach((table, index) => {
        console.log(`     ${index + 1}. ${table.schemaname}.${table.tablename} (owner: ${table.tableowner})`);
      });
    } else {
      console.log('   • No scheduler-related tables found');
    }
    
    // 6. Check for pg_cron extension
    console.log('\n6️⃣ PostgreSQL Extensions:');
    const extensions = await pool.query(`
      SELECT extname, extversion 
      FROM pg_extension 
      WHERE extname IN ('pg_cron', 'pg_stat_statements')
    `);
    
    if (extensions.rows.length > 0) {
      console.log(`   • Found ${extensions.rows.length} relevant extensions:`);
      extensions.rows.forEach((ext, index) => {
        console.log(`     ${index + 1}. ${ext.extname} v${ext.extversion}`);
      });
    } else {
      console.log('   • No relevant extensions found');
    }
    
    // 7. Summary and recommendations
    console.log('\n📋 Scheduler Analysis Summary:');
    
    if (notifStats.last_10_min > 0) {
      console.log('   ⚠️  Scheduler appears to be ACTIVE - notifications created recently');
      console.log('   ⚠️  This could explain the 9 PM lunch break notification!');
    } else {
      console.log('   ✅ No recent scheduler activity detected');
    }
    
    if (notifStats.last_hour > 10) {
      console.log('   ⚠️  High notification volume in last hour - scheduler may be running too frequently');
    }
    
    console.log('\n🔧 Recommendations:');
    console.log('   • Check if break-reminder-scheduler.js is running in background');
    console.log('   • Verify cron jobs or systemd services');
    console.log('   • Check database for any automated triggers calling check_break_reminders()');
    
  } catch (error) {
    console.error('❌ Error checking scheduler status:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchedulerStatus();
