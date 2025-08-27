const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function manualFixCurrentData() {
  try {
    console.log('🔧 Manual Fix for Current Data Situation...');
    
    // Check current time
    const now = new Date();
    console.log(`⏰ Current UTC time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Check current activity data
    console.log('\n📊 Current activity data before fix:');
    const beforeData = await pool.query(`
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
    
    console.log('📋 Recent activity records:');
    beforeData.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    });
    
    // Step 1: Fix the 8/26/2025 row - reset it to 0 values
    console.log('\n🔄 Step 1: Fixing 8/26/2025 row (reset to 0)...');
    const fixTodayResult = await pool.query(`
      UPDATE activity_data 
      SET 
        today_active_seconds = 0,
        today_inactive_seconds = 0,
        is_currently_active = FALSE,
        last_session_start = NULL,
        updated_at = NOW()
      WHERE user_id = 2 AND today_date = '2025-08-26'
    `);
    
    console.log(`✅ 8/26/2025 row fixed. Rows affected: ${fixTodayResult.rowCount}`);
    
    // Step 2: Restore the 8/25/2025 row with proper historical data
    console.log('\n🔄 Step 2: Restoring 8/25/2025 historical data...');
    const restoreYesterdayResult = await pool.query(`
      UPDATE activity_data 
      SET 
        today_active_seconds = 21966,
        today_inactive_seconds = 6856,
        updated_at = NOW()
      WHERE user_id = 2 AND today_date = '2025-08-25'
    `);
    
    console.log(`✅ 8/25/2025 row restored. Rows affected: ${restoreYesterdayResult.rowCount}`);
    
    // Check activity data after fix
    console.log('\n📊 Activity data after fix:');
    const afterData = await pool.query(`
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
    
    console.log('📋 Fixed activity records:');
    afterData.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    });
    
    console.log('\n✅ Manual fix completed successfully!');
    console.log('📋 Summary of changes:');
    console.log('   • 8/26/2025 row: Reset to 0 values (fresh start)');
    console.log('   • 8/25/2025 row: Restored historical data (preserved)');
    console.log('   • Historical records: Maintained intact');
    
  } catch (error) {
    console.error('❌ Error in manual fix:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the fix
manualFixCurrentData();
