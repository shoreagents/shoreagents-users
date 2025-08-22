const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRealTimeUpdates() {
  try {
    console.log('🧪 Testing Real-Time Online Status Updates...\n');
    
    // 1. Check socket server status
    console.log('1️⃣ Socket Server Status:');
    const { exec } = require('child_process');
    
    exec('netstat -an | grep :3001', (error, stdout, stderr) => {
      if (stdout) {
        console.log('   ✅ Socket server is running on port 3001');
        console.log('   📡 Active connections found');
      } else {
        console.log('   ❌ Socket server not running on port 3001');
      }
    });
    
    // 2. Check current online status
    console.log('\n2️⃣ Current Online Status:');
    const onlineStatusResult = await pool.query(`
      SELECT 
        u.email,
        u.user_type,
        CASE 
          WHEN ad.is_currently_active THEN '🟢 Active'
          WHEN ad.today_active_seconds > 0 THEN '🟡 Recently Active'
          ELSE '⚫ Inactive'
        END as activity_status
      FROM users u
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      WHERE u.user_type = 'Agent'
      ORDER BY ad.is_currently_active DESC
      LIMIT 3
    `);
    
    if (onlineStatusResult.rows.length > 0) {
      console.log('   Current user status:');
      onlineStatusResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.email}: ${row.activity_status}`);
      });
    }
    
    // 3. Testing instructions for real-time updates
    console.log('\n3️⃣ Real-Time Update Testing:');
    console.log('   🔧 To test real-time updates:');
    console.log('   1. Open leaderboard page in one browser tab');
    console.log('   2. Open another tab and login as different user');
    console.log('   3. In second tab, click logout');
    console.log('   4. Check first tab - user should show as offline WITHOUT page refresh');
    console.log('   5. Check browser console for these logs:');
    console.log('      - "📡 Leaderboard received online status update: X users"');
    console.log('      - "📡 Leaderboard received user status update: email -> offline"');
    console.log('      - "🔍 Leaderboard entry X: name (email) -> Status: offline"');
    
    // 4. Expected behavior
    console.log('\n4️⃣ Expected Behavior:');
    console.log('   ✅ User clicks logout');
    console.log('   ✅ Socket sends logout event to server');
    console.log('   ✅ Server marks user as offline');
    console.log('   ✅ Server broadcasts offline status to all clients');
    console.log('   ✅ Leaderboard component receives status update');
    console.log('   ✅ Leaderboard re-renders automatically');
    console.log('   ✅ User shows as offline without page refresh');
    
    // 5. Troubleshooting
    console.log('\n5️⃣ Troubleshooting:');
    console.log('   ❌ If updates require page refresh:');
    console.log('      - Check if socket is connected');
    console.log('      - Check if event listeners are attached');
    console.log('      - Check if online status context is updating');
    console.log('      - Check if leaderboard component is re-rendering');
    console.log('   ❌ If no real-time updates:');
    console.log('      - Check browser console for socket errors');
    console.log('      - Check socket server console for logout events');
    console.log('      - Verify socket event listeners are working');
    
    // 6. Socket event flow
    console.log('\n6️⃣ Socket Event Flow:');
    console.log('   Client logout → "user-logout" event → use-socket hook');
    console.log('   use-socket hook → "logout" event → socket server');
    console.log('   Socket server → "user-online-status" event → all clients');
    console.log('   Socket server → "online-status-update" event → all clients');
    console.log('   Leaderboard component → receives events → re-renders');
    
  } catch (error) {
    console.error('❌ Error testing real-time updates:', error.message);
  } finally {
    await pool.end();
  }
}

testRealTimeUpdates();
