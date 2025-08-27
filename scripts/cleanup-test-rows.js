const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanupTestRows() {
  console.log('🧹 Cleaning Up Test Rows\n');
  
  try {
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Looking for test rows for date: ${tomorrowDate}`);
    
    // Check if any rows exist for tomorrow
    const checkResult = await pool.query(`
      SELECT id, user_id, today_date, created_at
      FROM activity_data 
      WHERE today_date = $1
    `, [tomorrowDate]);
    
    if (checkResult.rows.length === 0) {
      console.log('✅ No test rows found for tomorrow');
    } else {
      console.log(`📊 Found ${checkResult.rows.length} test rows for tomorrow:`);
      checkResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}, User: ${row.user_id}, Date: ${row.today_date}`);
      });
      
      // Delete test rows
      console.log('\n🗑️ Deleting test rows...');
      const deleteResult = await pool.query(`
        DELETE FROM activity_data 
        WHERE today_date = $1
      `, [tomorrowDate]);
      
      console.log(`✅ Deleted ${deleteResult.rowCount} test rows`);
    }
    
    // Check current activity data
    console.log('\n📋 Current activity data:');
    const currentData = await pool.query(`
      SELECT id, user_id, today_date, today_active_seconds, today_inactive_seconds
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${currentData.rows.length} rows for user 2:`);
    currentData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

cleanupTestRows();
