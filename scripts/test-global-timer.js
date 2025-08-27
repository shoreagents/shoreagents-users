const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testGlobalTimer() {
  try {
    console.log('🧪 Testing Global Activity Timer function...');
    
    // Test the function
    const result = await pool.query('SELECT check_and_reset_activity_for_shift_starts() AS reset_count');
    const resetCount = result.rows[0]?.reset_count || 0;
    
    console.log(`✅ Function executed successfully`);
    console.log(`📊 Reset count: ${resetCount}`);
    
    // Check current activity data to see what happened
    console.log('\n📋 Checking current activity data...');
    const activityData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY today_date DESC 
      LIMIT 3
    `);
    
    console.log('📊 Recent activity records:');
    activityData.rows.forEach(row => {
      console.log(`  Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s | Updated: ${row.updated_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing Global Activity Timer:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testGlobalTimer();
