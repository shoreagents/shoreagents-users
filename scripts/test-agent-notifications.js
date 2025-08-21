const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testAgentNotifications() {
  console.log('🧪 Testing Agent Notifications for Day and Night Shifts\n');
  
  try {
    // First, let's check what functions we have available
    console.log('1️⃣ Checking available break notification functions...');
    const availableFunctions = await pool.query(`
      SELECT 
        proname,
        oidvectortypes(proargtypes) as args
      FROM pg_proc 
      WHERE proname IN (
        'is_break_available_now', 
        'is_break_available_soon', 
        'is_break_missed',
        'is_break_ending_soon',
        'check_break_reminders',
        'create_break_reminder_notification'
      )
      ORDER BY proname
    `);
    
    console.log(`   • Found ${availableFunctions.rows.length} break notification functions:`);
    availableFunctions.rows.forEach((func, index) => {
      console.log(`     ${index + 1}. ${func.proname}(${func.args})`);
    });
    
    // Check current time and timezone
    console.log('\n2️⃣ Current time and timezone status...');
    const timeStatus = await pool.query(`
      SELECT 
        NOW() as db_now,
        NOW() AT TIME ZONE 'Asia/Manila' as manila_now,
        EXTRACT(HOUR FROM NOW()) as db_hour,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_hour,
        EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_minute
    `);
    
    const time = timeStatus.rows[0];
    console.log(`   • Database time: ${time.db_now} (Hour: ${time.db_hour})`);
    console.log(`   • Manila time: ${time.manila_now} (Hour: ${time.manila_hour}:${time.manila_minute})`);
    
    // Test Agent User 2 (Day Shift)
    console.log('\n3️⃣ Testing Agent User 2 (Day Shift)...');
    
    // Get user 2's information
    const user2Info = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.user_type
      FROM users u
      WHERE u.id = 2
    `);
    
    if (user2Info.rows.length > 0) {
      const user2 = user2Info.rows[0];
      console.log(`   • ID: ${user2.id}`);
      console.log(`   • Email: ${user2.email}`);
      console.log(`   • Type: ${user2.user_type}`);
      
      // Test break availability functions for user 2
      console.log('\n   🔍 Testing break availability for User 2:');
      
      try {
        const user2Breaks = await pool.query(`
          SELECT 
            'Morning' as break_type,
            is_break_available_now(2, 'Morning'::break_type_enum) as available_now,
            is_break_available_soon(2, 'Morning'::break_type_enum) as available_soon
          UNION ALL
          SELECT 
            'Lunch' as break_type,
            is_break_available_now(2, 'Lunch'::break_type_enum) as available_now,
            is_break_available_soon(2, 'Lunch'::break_type_enum) as available_soon
          UNION ALL
          SELECT 
            'Afternoon' as break_type,
            is_break_available_now(2, 'Afternoon'::break_type_enum) as available_now,
            is_break_available_soon(2, 'Afternoon'::break_type_enum) as available_soon
        `);
        
        user2Breaks.rows.forEach(breakInfo => {
          console.log(`     • ${breakInfo.break_type}: Available now = ${breakInfo.available_now}, Available soon = ${breakInfo.available_soon}`);
        });
      } catch (error) {
        console.log(`     ❌ Error testing break availability: ${error.message}`);
      }
    } else {
      console.log('   ❌ User 2 not found');
    }
    
    // Test Agent User 4 (Night Shift)
    console.log('\n4️⃣ Testing Agent User 4 (Night Shift)...');
    
    const user4Info = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.user_type
      FROM users u
      WHERE u.id = 4
    `);
    
    if (user4Info.rows.length > 0) {
      const user4 = user4Info.rows[0];
      console.log(`   • ID: ${user4.id}`);
      console.log(`   • Email: ${user4.email}`);
      console.log(`   • Type: ${user4.user_type}`);
      
      // Test break availability functions for user 4
      console.log('\n   🔍 Testing break availability for User 4:');
      
      try {
        const user4Breaks = await pool.query(`
          SELECT 
            'NightFirst' as break_type,
            is_break_available_now(4, 'NightFirst'::break_type_enum) as available_now,
            is_break_available_soon(4, 'NightFirst'::break_type_enum) as available_soon
          UNION ALL
          SELECT 
            'NightMeal' as break_type,
            is_break_available_now(4, 'NightMeal'::break_type_enum) as available_now,
            is_break_available_soon(4, 'NightMeal'::break_type_enum) as available_soon
          UNION ALL
          SELECT 
            'NightSecond' as break_type,
            is_break_available_now(4, 'NightSecond'::break_type_enum) as available_now,
            is_break_available_soon(4, 'NightSecond'::break_type_enum) as available_soon
        `);
        
        user4Breaks.rows.forEach(breakInfo => {
          console.log(`     • ${breakInfo.break_type}: Available now = ${breakInfo.available_now}, Available soon = ${breakInfo.available_soon}`);
        });
      } catch (error) {
        console.log(`     ❌ Error testing break availability: ${error.message}`);
      }
    } else {
      console.log('   ❌ User 4 not found');
    }
    
    // Test the main scheduler function
    console.log('\n5️⃣ Testing check_break_reminders() function...');
    try {
      const schedulerResult = await pool.query(`SELECT check_break_reminders() as notifications_sent`);
      console.log(`   • Scheduler result: ${schedulerResult.rows[0].notifications_sent} notifications sent`);
      
      if (schedulerResult.rows[0].notifications_sent === 0) {
        console.log('   ✅ Scheduler correctly returned 0 (outside work hours or no eligible breaks)');
      } else {
        console.log('   ⚠️  Scheduler sent notifications - check if this is expected');
      }
    } catch (error) {
      console.log(`   ❌ Error testing scheduler: ${error.message}`);
    }
    
    // Check current notifications for both users
    console.log('\n6️⃣ Checking current notifications...');
    const currentNotifications = await pool.query(`
      SELECT 
        user_id,
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
        COUNT(CASE WHEN title LIKE '%available soon%' THEN 1 END) as available_soon,
        COUNT(CASE WHEN title LIKE '%available now%' THEN 1 END) as available_now,
        COUNT(CASE WHEN title LIKE '%not taken%' THEN 1 END) as missed_break,
        COUNT(CASE WHEN title LIKE '%ending soon%' THEN 1 END) as ending_soon,
        MAX(created_at) as latest_notification
      FROM notifications 
      WHERE category = 'break' AND user_id IN (2, 4)
      GROUP BY user_id
      ORDER BY user_id
    `);
    
    if (currentNotifications.rows.length > 0) {
      currentNotifications.rows.forEach(userNotifs => {
        console.log(`   • User ${userNotifs.user_id}:`);
        console.log(`     - Total: ${userNotifs.total}`);
        console.log(`     - Last hour: ${userNotifs.last_hour}`);
        console.log(`     - Available soon: ${userNotifs.available_soon}`);
        console.log(`     - Available now: ${userNotifs.available_now}`);
        console.log(`     - Missed break: ${userNotifs.missed_break}`);
        console.log(`     - Ending soon: ${userNotifs.ending_soon}`);
        console.log(`     - Latest: ${userNotifs.latest_notification || 'None'}`);
      });
    } else {
      console.log('   • No notifications found for users 2 and 4');
    }
    
    // Test notification creation for both users
    console.log('\n7️⃣ Testing notification creation...');
    
    // Test for User 2 (Day Shift: 7 AM - 4 PM) - should work during actual shift hours
    if (time.manila_hour >= 7 && time.manila_hour < 16) {
      console.log('   🌞 Day shift hours (7 AM - 4 PM) - testing User 2 notifications...');
      try {
        // Test available soon notification
        await pool.query(`SELECT create_break_reminder_notification(2, 'available_soon', 'Lunch'::break_type_enum)`);
        console.log('     ✅ Created "available soon" notification for User 2');
        
        // Test available now notification
        await pool.query(`SELECT create_break_reminder_notification(2, 'available_now', 'Lunch'::break_type_enum)`);
        console.log('     ✅ Created "available now" notification for User 2');
        
      } catch (error) {
        console.log(`     ❌ Error creating notifications for User 2: ${error.message}`);
      }
    } else {
      console.log('   🌙 Outside day shift hours (7 AM - 4 PM) - User 2 notifications should be blocked');
    }
    
    // Test for User 4 (Night Shift: 10 PM - 7 AM) - should work during actual shift hours
    if (time.manila_hour >= 22 || time.manila_hour < 7) {
      console.log('   🌙 Night shift hours (10 PM - 7 AM) - testing User 4 notifications...');
      try {
        // Test available soon notification
        await pool.query(`SELECT create_break_reminder_notification(4, 'available_soon', 'NightFirst'::break_type_enum)`);
        console.log('     ✅ Created "available soon" notification for User 4');
        
        // Test available now notification
        await pool.query(`SELECT create_break_reminder_notification(4, 'available_now', 'NightFirst'::break_type_enum)`);
        console.log('     ✅ Created "available now" notification for User 4');
        
      } catch (error) {
        console.log(`     ❌ Error creating notifications for User 4: ${error.message}`);
      }
    } else {
      console.log('   🌞 Outside night shift hours (10 PM - 7 AM) - User 4 notifications should be blocked');
    }
    
    // Check final notification count
    console.log('\n8️⃣ Final notification status...');
    const finalNotifications = await pool.query(`
      SELECT 
        user_id,
        COUNT(*) as total,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as recent,
        STRING_AGG(title, '; ') as titles
      FROM notifications 
      WHERE category = 'break' AND user_id IN (2, 4) AND created_at > NOW() - INTERVAL '5 minutes'
      GROUP BY user_id
      ORDER BY user_id
    `);
    
    if (finalNotifications.rows.length > 0) {
      finalNotifications.rows.forEach(userNotifs => {
        console.log(`   • User ${userNotifs.user_id}: ${userNotifs.recent} recent notifications`);
        console.log(`     - Titles: ${userNotifs.titles}`);
      });
    } else {
      console.log('   • No recent notifications created in the last 5 minutes');
    }
    
    // Summary and recommendations
    console.log('\n📋 TEST SUMMARY:');
    console.log('   ✅ Functions available: Checked');
    console.log('   ✅ User 2 (Day Shift): Tested');
    console.log('   ✅ User 4 (Night Shift): Tested');
    console.log('   ✅ Scheduler function: Tested');
    console.log('   ✅ Notification creation: Tested');
    
    console.log('\n🎯 Expected Behavior:');
    console.log('   • Day shift (User 2): Notifications during 7 AM - 4 PM only (actual shift time)');
    console.log('   • Night shift (User 4): Notifications during 10 PM - 7 AM only (actual shift time)');
    console.log('   • 4 notification types: available soon, available now, missed break, ending soon');
    console.log('   • Missed break reminders: Every 30 minutes if break not taken');
    console.log('   • Break times calculated dynamically from actual shift start times');
    console.log('   • No hardcoded assumptions - fully flexible for any shift configuration');
    
    console.log('\n⚠️  Next Steps:');
    console.log('   • Monitor notifications over the next few hours');
    console.log('   • Check if missed break reminders are working (every 30 min)');
    console.log('   • Verify timezone handling for both shift types');
    
  } catch (error) {
    console.error('❌ Error testing agent notifications:', error.message);
  } finally {
    await pool.end();
  }
}

testAgentNotifications();
