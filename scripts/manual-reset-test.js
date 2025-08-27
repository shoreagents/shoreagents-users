const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function manualResetTest() {
  try {
    console.log('🔄 Manual Activity Reset Test...');
    
    // Check current time
    const now = new Date();
    console.log(`⏰ Current time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Check current activity data
    console.log('\n📊 Current activity data before reset:');
    const beforeData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        updated_at
      FROM activity_data 
      WHERE user_id = 2 AND today_date = '2025-08-26'
    `);
    
    if (beforeData.rows.length > 0) {
      const row = beforeData.rows[0];
      console.log(`  Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    }
    
    // Manually reset the activity data for today
    console.log('\n🔄 Manually resetting activity data for today...');
    const resetResult = await pool.query(`
      UPDATE activity_data 
      SET 
        today_active_seconds = 0,
        today_inactive_seconds = 0,
        is_currently_active = FALSE,
        last_session_start = NULL,
        updated_at = NOW()
      WHERE user_id = 2 AND today_date = '2025-08-26'
    `);
    
    console.log(`✅ Reset completed. Rows affected: ${resetResult.rowCount}`);
    
    // Check activity data after reset
    console.log('\n📊 Activity data after reset:');
    const afterData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        updated_at
      FROM activity_data 
      WHERE user_id = 2 AND today_date = '2025-08-26'
    `);
    
    if (afterData.rows.length > 0) {
      const row = afterData.rows[0];
      console.log(`  Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    }
    
  } catch (error) {
    console.error('❌ Error in manual reset test:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
manualResetTest();
