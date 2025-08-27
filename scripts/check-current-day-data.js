const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentDayData() {
  try {
    console.log('🔍 Checking current day data in database...');
    
    // Calculate current Manila date (same logic as socket server)
    const now = new Date();
    const manilaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentDate = manilaTime.toISOString().split('T')[0];
    
    console.log(`⏰ Current UTC time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${manilaTime.toISOString()}`);
    console.log(`📅 Current date (Manila): ${currentDate}`);
    
    // Check for current day data
    const currentDayResult = await pool.query(
      'SELECT id, user_id, today_date, today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = 2 AND today_date = $1',
      [currentDate]
    );
    
    console.log(`\n📊 Current day (${currentDate}) data:`);
    if (currentDayResult.rows.length > 0) {
      currentDayResult.rows.forEach(row => {
        console.log(`  ✅ Found: ID ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
      });
    } else {
      console.log(`  ❌ No data found for current day`);
    }
    
    // Check all recent data
    const allDataResult = await pool.query(
      'SELECT id, user_id, today_date, today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = 2 ORDER BY today_date DESC LIMIT 5'
    );
    
    console.log(`\n📋 All recent data:`);
    allDataResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentDayData();
