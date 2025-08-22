const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkOnlineStatusFix() {
  try {
    console.log('🔍 Checking Online Status Fix...\n');
    
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
    
    // 2. Check current online status from database
    console.log('\n2️⃣ Current Database Status:');
    const onlineStatusResult = await pool.query(`
      SELECT 
        u.email,
        u.user_type,
        CASE 
          WHEN ad.is_currently_active THEN '🟢 Active (DB)'
          WHEN ad.today_active_seconds > 0 THEN '🟡 Recently Active (DB)'
          ELSE '⚫ Inactive (DB)'
        END as activity_status,
        ad.last_session_start,
        ad.updated_at
      FROM users u
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      WHERE u.user_type = 'Agent'
      ORDER BY ad.is_currently_active DESC
      LIMIT 5
    `);
    
    if (onlineStatusResult.rows.length > 0) {
      console.log('   Current user status from database:');
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
    
    // 3. Explain the fix
    console.log('\n3️⃣ What Was Fixed:');
    console.log('   ❌ Before: Users stayed "online" even after disconnecting');
    console.log('   ✅ After: Users are marked "offline" when they disconnect');
    console.log('   🔧 The socket server now properly handles disconnect events');
    console.log('   🔧 Users are marked offline when all connections are gone');
    console.log('   🔧 A 1-minute timeout cleans up disconnected user data');
    
    // 4. Testing instructions
    console.log('\n4️⃣ Testing Instructions:');
    console.log('   🔧 To test the fix:');
    console.log('   1. Open leaderboard page in one browser tab');
    console.log('   2. Open another tab and login as different user');
    console.log('   3. Close the second tab completely (don\'t logout)');
    console.log('   4. Wait 1-2 minutes for disconnect timeout');
    console.log('   5. Check first tab - user should show as offline');
    console.log('   6. Check browser console for disconnect logs');
    
    // 5. Expected behavior
    console.log('\n5️⃣ Expected Behavior:');
    console.log('   ✅ User opens browser → connects to socket → marked online');
    console.log('   ✅ User closes browser → socket disconnects → marked offline');
    console.log('   ✅ Other users see offline status in real-time');
    console.log('   ✅ No more "ghost online" users');
    
    // 6. Socket server logs to watch for
    console.log('\n6️⃣ Socket Server Logs to Watch:');
    console.log('   📡 "User X disconnected. Remaining connections: 0"');
    console.log('   📡 "No more connections for X, marking as offline"');
    console.log('   📡 "Broadcasted offline status for X to all connected users"');
    console.log('   📡 "Cleaning up user data for X after disconnect timeout"');
    
  } catch (error) {
    console.error('❌ Error checking online status fix:', error.message);
  } finally {
    await pool.end();
  }
}

checkOnlineStatusFix();
