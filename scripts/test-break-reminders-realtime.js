#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakRemindersRealTime() {
  try {
    console.log('🧪 REAL-TIME BREAK REMINDER TESTING TOOL\n');
    
    // Get user ID
    const userResult = await pool.query("SELECT id, email FROM users WHERE email = 'kyle.p@shoreagents.com'");
    if (userResult.rows.length === 0) {
      console.log('❌ User not found!');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log(`👤 Testing for: ${userResult.rows[0].email} (ID: ${userId})`);
    
    // Test different notification scenarios
    const testScenarios = [
      {
        name: 'Morning Break Available Soon',
        time: '2025-08-18 07:45:00',
        expected: 'available_soon for Morning'
      },
      {
        name: 'Lunch Break Available Soon', 
        time: '2025-08-18 09:45:00',
        expected: 'available_soon for Lunch'
      },
      {
        name: 'Afternoon Break Available Soon',
        time: '2025-08-18 13:30:00', // 1:30 PM
        expected: 'available_soon for Afternoon'
      },
      {
        name: 'Lunch Break Missed (10:30 AM)',
        time: '2025-08-18 10:30:00',
        expected: 'missed_break for Lunch'
      },
      {
        name: 'Lunch Window Closing Soon',
        time: '2025-08-18 12:45:00',
        expected: 'ending_soon for Lunch'
      }
    ];
    
    console.log('🎯 TESTING SCENARIOS:\n');
    
    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      console.log(`📋 ${i + 1}. ${scenario.name}`);
      console.log(`   🕐 Simulated Time: ${new Date(scenario.time).toLocaleString()}`);
      console.log(`   🎯 Expected: ${scenario.expected}`);
      
      try {
        // Test the specific functions
        const testResult = await pool.query(`
          SELECT 
            is_break_available_soon($1, 'Morning', $2::timestamp) as morning_available,
            is_break_available_soon($1, 'Lunch', $2::timestamp) as lunch_available,
            is_break_available_soon($1, 'Afternoon', $2::timestamp) as afternoon_available,
            is_break_missed($1, 'Morning', $2::timestamp) as morning_missed,
            is_break_missed($1, 'Lunch', $2::timestamp) as lunch_missed,
            is_break_missed($1, 'Afternoon', $2::timestamp) as afternoon_missed,
            is_break_ending_soon($1, $2::timestamp) as ending_soon
        `, [userId, scenario.time]);
        
        const result = testResult.rows[0];
        
        // Check which notifications would trigger
        const notifications = [];
        if (result.morning_available) notifications.push('📢 Morning Available Soon');
        if (result.lunch_available) notifications.push('📢 Lunch Available Soon');
        if (result.afternoon_available) notifications.push('📢 Afternoon Available Soon');
        if (result.morning_missed) notifications.push('🚨 Morning Missed');
        if (result.lunch_missed) notifications.push('🚨 Lunch Missed');
        if (result.afternoon_missed) notifications.push('🚨 Afternoon Missed');
        if (result.ending_soon) notifications.push('⏰ Window Closing Soon');
        
        if (notifications.length > 0) {
          console.log(`   ✅ Result: ${notifications.join(', ')}`);
          
          // Actually create the notification to test the full system
          console.log('   🔔 Creating test notification...');
          
          if (result.morning_available) {
            await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
              [userId, 'available_soon', 'Morning']);
          }
          if (result.lunch_available) {
            await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
              [userId, 'available_soon', 'Lunch']);
          }
          if (result.afternoon_available) {
            await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
              [userId, 'available_soon', 'Afternoon']);
          }
          if (result.lunch_missed) {
            await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
              [userId, 'missed_break', 'Lunch']);
          }
          if (result.ending_soon) {
            await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', 
              [userId, 'ending_soon', 'Lunch']);
          }
          
          console.log('   📤 Notification sent to database and socket!');
        } else {
          console.log('   ❌ No notifications would trigger');
        }
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
      
      console.log('');
    }
    
    // Show recent notifications
    console.log('📬 RECENT NOTIFICATIONS CREATED:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const recentNotifications = await pool.query(`
      SELECT title, message, created_at, payload
      FROM notifications 
      WHERE user_id = $1 
      AND category = 'break'
      AND created_at >= NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId]);
    
    if (recentNotifications.rows.length === 0) {
      console.log('   📭 No recent break notifications found');
    } else {
      recentNotifications.rows.forEach((notif, i) => {
        const payload = notif.payload || {};
        console.log(`   ${i + 1}. ${notif.title}`);
        console.log(`      📝 ${notif.message}`);
        console.log(`      🕐 ${notif.created_at.toLocaleString()}`);
        console.log(`      🏷️ Type: ${payload.notification_type || 'unknown'} | Break: ${payload.break_type || 'unknown'}`);
        console.log('');
      });
    }
    
    console.log('💡 HOW TO USE THIS TOOL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   1. Run this script: node scripts/test-break-reminders-realtime.js');
    console.log('   2. Check your app for notifications (notification bell)');
    console.log('   3. Check system notifications (Windows/OS level)');
    console.log('   4. Notifications are created in real-time without waiting!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testBreakRemindersRealTime();
