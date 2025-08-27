const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugDateMismatch() {
  try {
    console.log('🔍 Debugging Date Mismatch...');
    
    // Get all activity data for user 2
    const allData = await pool.query(
      'SELECT id, today_date, today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = 2 ORDER BY today_date DESC'
    );
    
    console.log('\n📋 All activity data for user 2:');
    allData.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ID: ${row.id} | Date: ${row.today_date} | Type: ${typeof row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
      
      // Try different date formats
      if (row.today_date) {
        const dateObj = new Date(row.today_date);
        console.log(`     - Date object: ${dateObj.toISOString()}`);
        console.log(`     - Date string: ${dateObj.toISOString().split('T')[0]}`);
        console.log(`     - Date parts: ${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`);
      }
    });
    
    // Test different query approaches
    console.log('\n🧪 Testing Different Query Approaches...');
    
    // Approach 1: Direct string comparison
    console.log('\n📊 Approach 1: Direct string comparison with 2025-08-26');
    const result1 = await pool.query(
      'SELECT id, today_date FROM activity_data WHERE user_id = 2 AND today_date::text LIKE $1',
      ['%2025-08-26%']
    );
    console.log(`  Result: ${result1.rows.length} rows`);
    
    // Approach 2: Extract date parts
    console.log('\n📊 Approach 2: Extract date parts');
    const result2 = await pool.query(
      `SELECT id, today_date, 
              EXTRACT(YEAR FROM today_date) as year,
              EXTRACT(MONTH FROM today_date) as month,
              EXTRACT(DAY FROM today_date) as day
       FROM activity_data WHERE user_id = 2`
    );
    console.log(`  Date parts:`, result2.rows.map(row => ({
      id: row.id,
      date: row.today_date,
      year: row.year,
      month: row.month,
      day: row.day
    })));
    
    // Approach 3: Cast to date
    console.log('\n📊 Approach 3: Cast to date');
    const result3 = await pool.query(
      'SELECT id, today_date, today_date::date as casted_date FROM activity_data WHERE user_id = 2'
    );
    console.log(`  Casted dates:`, result3.rows.map(row => ({
      id: row.id,
      original: row.today_date,
      casted: row.casted_date
    })));
    
    // Approach 4: Test our fixed query with the actual stored date
    if (allData.rows.length > 0) {
      const firstRow = allData.rows[0];
      console.log('\n📊 Approach 4: Test with actual stored date');
      console.log(`  Testing with: ${firstRow.today_date}`);
      
      const result4 = await pool.query(
        'SELECT id, today_date FROM activity_data WHERE user_id = 2 AND today_date = $1',
        [firstRow.today_date]
      );
      console.log(`  Result: ${result4.rows.length} rows`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugDateMismatch();
