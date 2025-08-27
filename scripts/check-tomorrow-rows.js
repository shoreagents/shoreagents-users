const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkTomorrowRows() {
  console.log('🔍 Checking for Tomorrow\'s Rows\n');
  
  try {
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Checking for rows on date: ${tomorrowDate}`);
    
    // Check all users for tomorrow's rows
    const tomorrowCheck = await pool.query(`
      SELECT 
        ad.id, 
        ad.user_id, 
        u.email,
        ad.today_date, 
        ad.created_at,
        ad.today_active_seconds,
        ad.today_inactive_seconds
      FROM activity_data ad
      JOIN users u ON u.id = ad.user_id
      WHERE ad.today_date = $1
      ORDER BY ad.user_id
    `, [tomorrowDate]);
    
    if (tomorrowCheck.rows.length === 0) {
      console.log('❌ No rows found for tomorrow - function should create them!');
    } else {
      console.log(`✅ Found ${tomorrowCheck.rows.length} rows for tomorrow:`);
      tomorrowCheck.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. User: ${row.email} (ID: ${row.user_id})`);
        console.log(`      • Row ID: ${row.id}`);
        console.log(`      • Date: ${row.today_date}`);
        console.log(`      • Created: ${row.created_at}`);
        console.log(`      • Active: ${row.today_active_seconds}s`);
        console.log(`      • Inactive: ${row.today_inactive_seconds}s`);
      });
    }
    
    // Check current activity data for comparison
    console.log('\n📋 Current activity data for comparison:');
    const currentData = await pool.query(`
      SELECT 
        ad.id, 
        ad.user_id, 
        u.email,
        ad.today_date, 
        ad.created_at,
        ad.today_active_seconds,
        ad.today_inactive_seconds
      FROM activity_data ad
      JOIN users u ON u.id = ad.user_id
      WHERE ad.user_id IN (2, 4)  -- Check our test users
      ORDER BY ad.user_id, ad.created_at DESC
      LIMIT 10
    `);
    
    console.log(`📊 Found ${currentData.rows.length} current rows:`);
    currentData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. User: ${row.email} (ID: ${row.user_id})`);
      console.log(`      • Row ID: ${row.id}`);
      console.log(`      • Date: ${row.today_date}`);
      console.log(`      • Created: ${row.created_at}`);
      console.log(`      • Active: ${row.today_active_seconds}s`);
      console.log(`      • Inactive: ${row.today_inactive_seconds}s`);
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkTomorrowRows();
