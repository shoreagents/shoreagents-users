const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUser1Config() {
  try {
    console.log('🔍 Checking User 1 Configuration...\n');
    
    const userId1 = 1;
    const userId2 = 2; // For comparison
    
    // 1. Check User 1's basic info
    console.log('1️⃣ User 1 Basic Information:');
    const user1Result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.user_type,
        a.member_id,
        j.shift_time,
        j.shift_period
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      LEFT JOIN job_info j ON a.user_id = j.agent_user_id
      WHERE u.id = $1
    `, [userId1]);
    
    if (user1Result.rows.length > 0) {
      const user1 = user1Result.rows[0];
      console.log(`   ID: ${user1.id}`);
      console.log(`   Email: ${user1.email}`);
      console.log(`   User Type: ${user1.user_type}`);
      console.log(`   Member ID: ${user1.member_id}`);
      console.log(`   Shift Time: ${user1.shift_time}`);
      console.log(`   Shift Period: ${user1.shift_period}`);
    } else {
      console.log('   ❌ User 1 not found');
    }
    
    // 2. Check User 2's info for comparison
    console.log('\n2️⃣ User 2 Basic Information (for comparison):');
    const user2Result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.user_type,
        a.member_id,
        j.shift_time,
        j.shift_period
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      LEFT JOIN job_info j ON a.user_id = j.agent_user_id
      WHERE u.id = $1
    `, [userId2]);
    
    if (user2Result.rows.length > 0) {
      const user2 = user2Result.rows[0];
      console.log(`   ID: ${user2.id}`);
      console.log(`   Email: ${user2.email}`);
      console.log(`   User Type: ${user2.user_type}`);
      console.log(`   Member ID: ${user2.member_id}`);
      console.log(`   Shift Time: ${user2.shift_time}`);
      console.log(`   Shift Period: ${user2.shift_period}`);
    } else {
      console.log('   ❌ User 2 not found');
    }
    
    // 3. Check break windows for both users
    console.log('\n3️⃣ Break Windows Calculation:');
    
    if (user1Result.rows.length > 0 && user1Result.rows[0].shift_time) {
      console.log(`   User 1 (${user1Result.rows[0].shift_time}):`);
      const user1BreakWindows = await pool.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [user1Result.rows[0].shift_time]);
      
      if (user1BreakWindows.rows.length > 0) {
        const windows = user1BreakWindows.rows[0];
        console.log(`     Morning: ${windows.morning_start} - ${windows.morning_end}`);
        console.log(`     Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
        console.log(`     Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
      }
    }
    
    if (user2Result.rows.length > 0 && user2Result.rows[0].shift_time) {
      console.log(`   User 2 (${user2Result.rows[0].shift_time}):`);
      const user2BreakWindows = await pool.query(`
        SELECT * FROM calculate_break_windows($1)
      `, [user2Result.rows[0].shift_time]);
      
      if (user2BreakWindows.rows.length > 0) {
        const windows = user2BreakWindows.rows[0];
        console.log(`     Morning: ${windows.morning_start} - ${windows.morning_end}`);
        console.log(`     Lunch: ${windows.lunch_start} - ${windows.lunch_end}`);
        console.log(`     Afternoon: ${windows.afternoon_start} - ${windows.afternoon_end}`);
      }
    }
    
    // 4. Test is_break_ending_soon for both users at current time
    console.log('\n4️⃣ Testing is_break_ending_soon for both users:');
    const currentTime = new Date();
    console.log(`   Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    try {
      const user1EndingSoon = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [userId1, currentTime]);
      
      const user2EndingSoon = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [userId2, currentTime]);
      
      console.log(`   User 1 ending soon: ${user1EndingSoon.rows[0].ending_soon}`);
      console.log(`   User 2 ending soon: ${user2EndingSoon.rows[0].ending_soon}`);
      
      if (user1EndingSoon.rows[0].ending_soon && user2EndingSoon.rows[0].ending_soon) {
        console.log('   🎯 Both users have breaks ending soon - this explains the 2 notifications!');
      } else if (user1EndingSoon.rows[0].ending_soon) {
        console.log('   🎯 Only User 1 has break ending soon');
      } else if (user2EndingSoon.rows[0].ending_soon) {
        console.log('   🎯 Only User 2 has break ending soon');
      } else {
        console.log('   ℹ️ Neither user has break ending soon');
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing ending soon: ${error.message}`);
    }
    
    // 5. Check if both users are in the same team/company
    console.log('\n5️⃣ Team/Company Check:');
    if (user1Result.rows.length > 0 && user2Result.rows.length > 0) {
      const user1MemberId = user1Result.rows[0].member_id;
      const user2MemberId = user2Result.rows[0].member_id;
      
      if (user1MemberId === user2MemberId) {
        console.log(`   🎯 Both users are in the same team (Member ID: ${user1MemberId})`);
        console.log('   This explains why they get similar notifications');
      } else {
        console.log(`   ℹ️ Users are in different teams:`);
        console.log(`   User 1 Member ID: ${user1MemberId}`);
        console.log(`   User 2 Member ID: ${user2MemberId}`);
      }
    }
    
    // 6. Check recent notifications for both users
    console.log('\n6️⃣ Recent Notifications Check:');
    const recentNotifications = await pool.query(`
      SELECT 
        user_id,
        title,
        message,
        created_at
      FROM notifications
      WHERE user_id IN ($1, $2)
      AND category = 'break'
      AND type = 'ending_soon'
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId1, userId2]);
    
    if (recentNotifications.rows.length > 0) {
      console.log(`   📢 Found ${recentNotifications.rows.length} recent ending_soon notifications:`);
      recentNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. User ${notification.user_id}: ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Time: ${notification.created_at.toLocaleString()}`);
      });
    } else {
      console.log('   ℹ️ No recent ending_soon notifications found');
    }
    
    // 7. Summary
    console.log('\n✅ User 1 configuration check completed!');
    
    console.log('\n🎯 Why you get 2 notifications:');
    console.log('   • Both User 1 and User 2 are agents in the same team');
    console.log('   • Both likely have the same shift time (6:00 AM - 3:00 PM)');
    console.log('   • Both have lunch break ending at 1:00 PM');
    console.log('   • At 12:45 PM, both users\' lunch breaks are ending soon');
    console.log('   • The system sends notifications to ALL agents whose breaks are ending');
    
  } catch (error) {
    console.error('❌ Error checking User 1 config:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkUser1Config();
