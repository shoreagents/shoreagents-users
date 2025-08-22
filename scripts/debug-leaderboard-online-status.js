const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugLeaderboardOnlineStatus() {
  try {
    console.log('🔍 Debugging Leaderboard Online Status Issue...\n');
    
    // 1. Check if socket server is running
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
    
    // 2. Check leaderboard data structure
    console.log('\n2️⃣ Leaderboard Data Structure:');
    const leaderboardResult = await pool.query(`
      SELECT 
        u.id as user_id,
        u.email,
        pi.first_name,
        pi.last_name,
        COALESCE(ps.productivity_score, 0) as productivity_score
      FROM users u
      LEFT JOIN agents a ON u.id = a.user_id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      LEFT JOIN productivity_scores ps ON u.id = ps.user_id AND ps.month_year = '2025-08'
      WHERE u.user_type = 'Agent'
      ORDER BY ps.productivity_score DESC NULLS LAST, u.id
      LIMIT 5
    `);
    
    if (leaderboardResult.rows.length > 0) {
      console.log('   Sample leaderboard entries:');
      leaderboardResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.user_id}, Email: ${row.email}, Name: ${row.first_name} ${row.last_name}`);
      });
    } else {
      console.log('   No leaderboard data found');
    }
    
    // 3. Check if there are any online status records
    console.log('\n3️⃣ Online Status Check:');
    const onlineStatusResult = await pool.query(`
      SELECT 
        u.email,
        u.user_type,
        CASE 
          WHEN ad.is_currently_active THEN 'active'
          WHEN ad.today_active_seconds > 0 THEN 'recently_active'
          ELSE 'inactive'
        END as activity_status
      FROM users u
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      WHERE u.user_type = 'Agent'
      LIMIT 5
    `);
    
    if (onlineStatusResult.rows.length > 0) {
      console.log('   User activity status:');
      onlineStatusResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.email}: ${row.activity_status}`);
      });
    }
    
    // 4. Check socket server logs (if accessible)
    console.log('\n4️⃣ Socket Server Analysis:');
    console.log('   The issue is likely one of these:');
    console.log('   ❌ Socket server not sending online status updates');
    console.log('   ❌ Frontend not receiving socket events');
    console.log('   ❌ Online status context not updating properly');
    console.log('   ❌ Leaderboard component not re-rendering on status changes');
    
    // 5. Check if the issue is in the data flow
    console.log('\n5️⃣ Data Flow Analysis:');
    console.log('   Leaderboard API returns: userId = email (string)');
    console.log('   Leaderboard component calls: getUserStatus(entry.userId)');
    console.log('   Online status context stores: status by email');
    console.log('   This should work, but there might be a timing issue');
    
    // 6. Recommendations
    console.log('\n6️⃣ Recommendations:');
    console.log('   🔧 Check browser console for socket connection errors');
    console.log('   🔧 Verify socket events are being received');
    console.log('   🔧 Add console.log to online status context updates');
    console.log('   🔧 Check if leaderboard re-renders when status changes');
    console.log('   🔧 Ensure socket server is sending status updates to all clients');
    
  } catch (error) {
    console.error('❌ Error debugging leaderboard online status:', error.message);
  } finally {
    await pool.end();
  }
}

debugLeaderboardOnlineStatus();
