const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testLogoutManually() {
  try {
    console.log('🧪 Testing Logout Flow Manually...\n');
    
    // 1. Check current status
    console.log('1️⃣ Current Status Before Test:');
    const currentStatus = await pool.query(`
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
    
    if (currentStatus.rows.length > 0) {
      console.log('   Current user status:');
      currentStatus.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.email}: ${row.activity_status}`);
      });
    }
    
    // 2. Instructions for manual testing
    console.log('\n2️⃣ Manual Testing Instructions:');
    console.log('   🔧 To test logout flow:');
    console.log('   1. Open leaderboard page in one browser tab');
    console.log('   2. Open another tab and login as a different user');
    console.log('   3. In the second tab, click logout');
    console.log('   4. Check the first tab - user should show as offline');
    console.log('   5. Check browser console for these logs:');
    console.log('      - "🚪 Logout event dispatched"');
    console.log('      - "🚪 Logout detected - disconnecting socket"');
    console.log('      - "🔌 Disconnecting socket after logout processing"');
    console.log('   6. Check socket server console for these logs:');
    console.log('      - "🚪 User X logging out - marking as offline"');
    console.log('      - "📡 Broadcasting offline status for X to all connected users"');
    console.log('      - "✅ User X successfully logged out and marked as offline"');
    
    // 3. Expected behavior
    console.log('\n3️⃣ Expected Behavior:');
    console.log('   ✅ User clicks logout');
    console.log('   ✅ forceLogout() called');
    console.log('   ✅ CustomEvent "user-logout" dispatched');
    console.log('   ✅ use-socket hook receives event');
    console.log('   ✅ Socket emits "logout" to server');
    console.log('   ✅ Server marks user as offline');
    console.log('   ✅ Server broadcasts offline status');
    console.log('   ✅ Other users see offline status in real-time');
    console.log('   ✅ Page redirects to login after 500ms delay');
    
    // 4. Troubleshooting
    console.log('\n4️⃣ Troubleshooting:');
    console.log('   ❌ If user stays online:');
    console.log('      - Check if socket is connected');
    console.log('      - Check browser console for errors');
    console.log('      - Check socket server console for logout events');
    console.log('      - Verify event listeners are attached');
    console.log('   ❌ If socket not connected:');
    console.log('      - Check if use-socket hook is loaded');
    console.log('      - Check if socket server is running');
    console.log('      - Check network connectivity');
    
    // 5. Socket server status
    console.log('\n5️⃣ Socket Server Status:');
    const { exec } = require('child_process');
    
    exec('netstat -an | grep :3001', (error, stdout, stderr) => {
      if (stdout) {
        console.log('   ✅ Socket server is running on port 3001');
        console.log('   📡 Active connections found');
      } else {
        console.log('   ❌ Socket server not running on port 3001');
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing logout manually:', error.message);
  } finally {
    await pool.end();
  }
}

testLogoutManually();
