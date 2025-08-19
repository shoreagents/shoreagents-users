const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugDuplicateNotifications() {
  try {
    console.log('🔍 Debugging Duplicate Notifications...\n');
    
    const userId1 = 1;
    const userId2 = 2;
    const testTime = '2025-08-19 12:45:00'; // When the notifications were sent
    
    // 1. Check what happened at 12:45 PM
    console.log('1️⃣ Testing what happened at 12:45 PM:');
    console.log(`   Test time: ${testTime}`);
    
    // Test is_break_ending_soon for both users at 12:45 PM
    try {
      const user1EndingSoon = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [userId1, testTime]);
      
      const user2EndingSoon = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [userId2, testTime]);
      
      console.log(`   User 1 ending soon at 12:45 PM: ${user1EndingSoon.rows[0].ending_soon}`);
      console.log(`   User 2 ending soon at 12:45 PM: ${user2EndingSoon.rows[0].ending_soon}`);
      
      if (user1EndingSoon.rows[0].ending_soon) {
        console.log('   🚨 PROBLEM: User 1 has no shift time but is_break_ending_soon returns true!');
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing ending soon: ${error.message}`);
    }
    
    // 2. Check the is_break_ending_soon function logic
    console.log('\n2️⃣ Checking is_break_ending_soon function logic:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_ending_soon'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for potential issues
      if (source.includes('get_agent_shift_info')) {
        console.log('\n   📍 Function calls get_agent_shift_info');
      }
      
      if (source.includes('calculate_break_windows')) {
        console.log('   📍 Function calls calculate_break_windows');
      }
      
      // Look for null handling
      if (source.includes('IS NULL') || source.includes('IS NOT NULL')) {
        console.log('   📍 Function has NULL checks');
      }
    }
    
    // 3. Test get_agent_shift_info for User 1
    console.log('\n3️⃣ Testing get_agent_shift_info for User 1:');
    try {
      const user1ShiftInfo = await pool.query(`
        SELECT * FROM get_agent_shift_info($1)
      `, [userId1]);
      
      if (user1ShiftInfo.rows.length > 0) {
        console.log(`   📊 User 1 shift info: ${JSON.stringify(user1ShiftInfo.rows[0])}`);
        
        if (user1ShiftInfo.rows[0].shift_time) {
          console.log('   🚨 PROBLEM: get_agent_shift_info returns shift_time for User 1!');
          console.log('   This explains why they get notifications despite having null in job_info');
        } else {
          console.log('   ✅ get_agent_shift_info correctly returns no shift time');
        }
      } else {
        console.log('   ℹ️ get_agent_shift_info returns no rows for User 1');
      }
      
    } catch (error) {
      console.log(`   ❌ Error getting shift info: ${error.message}`);
    }
    
    // 4. Check what happens when we call check_break_reminders
    console.log('\n4️⃣ Testing check_break_reminders function:');
    try {
      const checkResult = await pool.query(`
        SELECT check_break_reminders()
      `);
      
      console.log(`   ✅ Function executed successfully - Notifications sent: ${checkResult.rows[0].check_break_reminders}`);
      
      // Check what notifications were created
      const newNotifications = await pool.query(`
        SELECT 
          user_id,
          title,
          message,
          created_at
        FROM notifications
        WHERE category = 'break'
        AND created_at > NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 10
      `);
      
      if (newNotifications.rows.length > 0) {
        console.log(`   📢 Found ${newNotifications.rows.length} new notifications:`);
        newNotifications.rows.forEach((notification, index) => {
          console.log(`   ${index + 1}. User ${notification.user_id}: ${notification.title}`);
          console.log(`      Message: ${notification.message}`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing check_break_reminders: ${error.message}`);
    }
    
    // 5. Check the actual database state
    console.log('\n5️⃣ Database State Check:');
    
    // Check if User 1 has any shift-related data
    const user1DataCheck = await pool.query(`
      SELECT 
        u.id,
        u.email,
        a.member_id,
        j.shift_time,
        j.shift_period,
        j.agent_user_id
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      LEFT JOIN job_info j ON u.id = j.agent_user_id
      WHERE u.id = $1
    `, [userId1]);
    
    if (user1DataCheck.rows.length > 0) {
      const user1Data = user1DataCheck.rows[0];
      console.log(`   User 1 data:`);
      console.log(`     ID: ${user1Data.id}`);
      console.log(`     Email: ${user1Data.email}`);
      console.log(`     Member ID: ${user1Data.member_id}`);
      console.log(`     Shift Time: ${user1Data.shift_time}`);
      console.log(`     Shift Period: ${user1Data.shift_period}`);
      console.log(`     Agent User ID: ${user1Data.agent_user_id}`);
      
      if (user1Data.shift_time === null && user1Data.agent_user_id) {
        console.log('   🚨 PROBLEM: User 1 is an agent but has no shift time!');
        console.log('   This should prevent them from getting break notifications');
      }
    }
    
    // 6. Summary and explanation
    console.log('\n✅ Duplicate notifications debug completed!');
    
    console.log('\n🎯 Why User 1 gets notifications despite no shift time:');
    console.log('   • User 1 is an agent (has record in agents table)');
    console.log('   • User 1 has no shift time configured (null in job_info)');
    console.log('   • But get_agent_shift_info might be returning default values');
    console.log('   • This causes is_break_ending_soon to return true incorrectly');
    console.log('   • Result: User 1 gets notifications they shouldn\'t get');
    
    console.log('\n🔧 The fix needed:');
    console.log('   • is_break_ending_soon should return false for users with no shift time');
    console.log('   • get_agent_shift_info should handle null shift times properly');
    console.log('   • Only users with valid shift times should get break notifications');
    
  } catch (error) {
    console.error('❌ Error debugging duplicate notifications:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugDuplicateNotifications();
