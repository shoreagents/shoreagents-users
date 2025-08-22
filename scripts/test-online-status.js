const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testOnlineStatus() {
  try {
    console.log('🧪 Testing Online Status System...\n');
    
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
    
    // 2. Check current online status in database
    console.log('\n2️⃣ Current User Activity Status:');
    const activityResult = await pool.query(`
      SELECT 
        u.email,
        u.user_type,
        ad.is_currently_active,
        ad.today_active_seconds,
        ad.today_inactive_seconds,
        CASE 
          WHEN ad.is_currently_active THEN '🟢 Active'
          WHEN ad.today_active_seconds > 0 THEN '🟡 Recently Active'
          ELSE '⚫ Inactive'
        END as status_display
      FROM users u
      LEFT JOIN activity_data ad ON u.id = ad.user_id AND ad.today_date = CURRENT_DATE
      WHERE u.user_type = 'Agent'
      ORDER BY ad.is_currently_active DESC, ad.today_active_seconds DESC
      LIMIT 5
    `);
    
    if (activityResult.rows.length > 0) {
      console.log('   Current user activity:');
      activityResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.email}: ${row.status_display}`);
      });
    } else {
      console.log('   No user activity data found');
    }
    
    // 3. Check leaderboard data
    console.log('\n3️⃣ Leaderboard Data:');
    const leaderboardResult = await pool.query(`
      SELECT 
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
      LIMIT 3
    `);
    
    if (leaderboardResult.rows.length > 0) {
      console.log('   Top leaderboard entries:');
      leaderboardResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.first_name} ${row.last_name} (${row.email}): ${row.productivity_score} pts`);
      });
    }
    
    // 4. Instructions for testing
    console.log('\n4️⃣ Testing Instructions:');
    console.log('   🔧 Open the leaderboard page in your browser');
    console.log('   🔧 Check browser console for socket connection logs');
    console.log('   🔧 Look for these log messages:');
    console.log('      - "🔌 Setting up online status socket listeners"');
    console.log('      - "📡 Requesting initial online status..."');
    console.log('      - "📡 Received bulk online-status-update: X users"');
    console.log('      - "📊 Leaderboard: Online status changed: {...}"');
    console.log('   🔧 The online status indicators should update in real-time');
    console.log('   🔧 No page refresh should be needed');
    
    // 5. Expected behavior
    console.log('\n5️⃣ Expected Behavior:');
    console.log('   ✅ Socket connects automatically');
    console.log('   ✅ Initial online status received');
    console.log('   ✅ Leaderboard shows real-time status');
    console.log('   ✅ Status updates without page refresh');
    console.log('   ✅ Periodic updates every 10 seconds');
    
  } catch (error) {
    console.error('❌ Error testing online status:', error.message);
  } finally {
    await pool.end();
  }
}

testOnlineStatus();
