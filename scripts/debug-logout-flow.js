const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugLogoutFlow() {
  try {
    console.log('🔍 Debugging Logout Flow...\n');
    
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
        END as activity_status,
        ad.last_session_start,
        ad.updated_at
      FROM users u
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      WHERE u.user_type = 'Agent'
      ORDER BY ad.is_currently_active DESC, ad.today_active_seconds DESC
      LIMIT 5
    `);
    
    if (onlineStatusResult.rows.length > 0) {
      console.log('   Current user status:');
      onlineStatusResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.email}: ${row.activity_status}`);
        if (row.last_session_start) {
          console.log(`      Last session: ${row.last_session_start}`);
        }
        if (row.updated_at) {
          console.log(`      Last updated: ${row.updated_at}`);
        }
      });
    }
    
    // 3. Check socket server logs for logout events
    console.log('\n3️⃣ Logout Flow Analysis:');
    console.log('   The logout flow should work like this:');
    console.log('   1. User clicks logout → forceLogout() called');
    console.log('   2. CustomEvent "user-logout" dispatched');
    console.log('   3. use-socket hook listens for event');
    console.log('   4. Socket emits "logout" to server');
    console.log('   5. Server marks user as offline');
    console.log('   6. Server broadcasts offline status');
    
    // 4. Check for potential issues
    console.log('\n4️⃣ Potential Issues:');
    console.log('   ❌ Socket not connected when logout called');
    console.log('   ❌ Event listener not properly attached');
    console.log('   ❌ Socket server not receiving logout event');
    console.log('   ❌ Server not broadcasting offline status');
    console.log('   ❌ Frontend not receiving status update');
    
    // 5. Testing instructions
    console.log('\n5️⃣ Testing Instructions:');
    console.log('   🔧 Open browser console and look for:');
    console.log('      - "🚪 Logout event dispatched"');
    console.log('      - "🚪 Logout detected - disconnecting socket"');
    console.log('      - "🚪 User X logging out - marking as offline"');
    console.log('      - "✅ User X successfully logged out and marked as offline"');
    console.log('   🔧 Check if socket server logs show logout events');
    console.log('   🔧 Verify offline status is broadcast to other users');
    
    // 6. Manual test steps
    console.log('\n6️⃣ Manual Test Steps:');
    console.log('   1. Open leaderboard in one browser tab');
    console.log('   2. Open another tab and login as different user');
    console.log('   3. In second tab, click logout');
    console.log('   4. Check first tab - user should show as offline');
    console.log('   5. Check browser console for logout logs');
    console.log('   6. Check socket server console for logout logs');
    
  } catch (error) {
    console.error('❌ Error debugging logout flow:', error.message);
  } finally {
    await pool.end();
  }
}

debugLogoutFlow();
