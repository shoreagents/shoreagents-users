require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function findUserWithData() {
  try {
    console.log('🔍 Finding which user has the 6h 47m activity data...');
    
    // Get all users with productivity data
    const currentMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).substring(0, 7); // YYYY-MM
    
    console.log('\n👥 All users with productivity scores:');
    const usersWithDataResult = await pool.query(
      `SELECT 
        ps.user_id,
        u.email,
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds,
        ps.updated_at
       FROM productivity_scores ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.month_year = $1
       ORDER BY ps.total_active_seconds DESC`,
      [currentMonth]
    );
    
    usersWithDataResult.rows.forEach(user => {
      const activeHours = Math.floor(user.total_active_seconds / 3600);
      const activeMinutes = Math.floor((user.total_active_seconds % 3600) / 60);
      const inactiveHours = Math.floor(user.total_inactive_seconds / 3600);
      const inactiveMinutes = Math.floor((user.total_inactive_seconds % 3600) / 60);
      
      console.log(`  ${user.email} (ID: ${user.user_id}):`);
      console.log(`    Active: ${user.total_active_seconds}s (${activeHours}h ${activeMinutes}m)`);
      console.log(`    Inactive: ${user.total_inactive_seconds}s (${inactiveHours}h ${inactiveMinutes}m)`);
      console.log(`    Score: ${user.productivity_score}%`);
      console.log(`    Updated: ${user.updated_at}`);
      console.log('');
    });
    
    // Look specifically for the user with ~6h 47m (6*3600 + 47*60 = 24,420 seconds)
    const targetActiveSeconds = 6 * 3600 + 47 * 60; // 24,420 seconds
    const tolerance = 300; // 5 minutes tolerance
    
    console.log(`🎯 Looking for user with ~${targetActiveSeconds}s (6h 47m) active time...`);
    
    const matchingUsers = usersWithDataResult.rows.filter(user => 
      Math.abs(user.total_active_seconds - targetActiveSeconds) < tolerance
    );
    
    if (matchingUsers.length > 0) {
      console.log('✅ Found matching user(s):');
      matchingUsers.forEach(user => {
        const activeHours = Math.floor(user.total_active_seconds / 3600);
        const activeMinutes = Math.floor((user.total_active_seconds % 3600) / 60);
        console.log(`  👤 ${user.email} has ${activeHours}h ${activeMinutes}m active time`);
      });
    } else {
      console.log('❌ No user found with exactly 6h 47m. Closest matches:');
      usersWithDataResult.rows.forEach(user => {
        const activeHours = Math.floor(user.total_active_seconds / 3600);
        const activeMinutes = Math.floor((user.total_active_seconds % 3600) / 60);
        console.log(`  ${user.email}: ${activeHours}h ${activeMinutes}m`);
      });
    }
    
    // Also check activity_data table for current month
    console.log('\n📊 Current month activity_data totals by user:');
    const monthStart = `${currentMonth}-01`;
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    
    const activityTotalsResult = await pool.query(
      `SELECT 
        ad.user_id,
        u.email,
        SUM(ad.today_active_seconds) as total_active_seconds,
        SUM(ad.today_inactive_seconds) as total_inactive_seconds,
        COUNT(*) as days_count,
        MAX(ad.updated_at) as last_updated
       FROM activity_data ad
       JOIN users u ON ad.user_id = u.id
       WHERE ad.today_date BETWEEN $1 AND $2
       GROUP BY ad.user_id, u.email
       ORDER BY total_active_seconds DESC`,
      [monthStart, monthEnd]
    );
    
    activityTotalsResult.rows.forEach(user => {
      const activeHours = Math.floor(user.total_active_seconds / 3600);
      const activeMinutes = Math.floor((user.total_active_seconds % 3600) / 60);
      const activeSeconds = user.total_active_seconds % 60;
      const inactiveHours = Math.floor(user.total_inactive_seconds / 3600);
      const inactiveMinutes = Math.floor((user.total_inactive_seconds % 3600) / 60);
      const inactiveSecondsRem = user.total_inactive_seconds % 60;
      
      console.log(`  ${user.email} (ID: ${user.user_id}):`);
      console.log(`    Active: ${user.total_active_seconds}s (${activeHours}h ${activeMinutes}m ${activeSeconds}s)`);
      console.log(`    Inactive: ${user.total_inactive_seconds}s (${inactiveHours}h ${inactiveMinutes}m ${inactiveSecondsRem}s)`);
      console.log(`    Days: ${user.days_count}, Last updated: ${user.last_updated}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  } finally {
    await pool.end();
  }
}

findUserWithData();