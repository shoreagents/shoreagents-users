const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFixedQuery() {
  try {
    console.log('🧪 Testing Fixed Query...');
    
    // Calculate current Manila date (same logic as socket server)
    const now = new Date();
    const manilaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentDate = manilaTime.toISOString().split('T')[0];
    
    console.log(`📅 Current date (Manila): ${currentDate}`);
    
    // Test the OLD query (should fail)
    console.log('\n📊 Test 1: OLD query (should fail)');
    try {
      const oldResult = await pool.query(
        'SELECT id, today_date FROM activity_data WHERE user_id = 2 AND today_date = $1',
        [currentDate]
      );
      console.log(`  ❌ OLD query returned ${oldResult.rows.length} rows (unexpected)`);
    } catch (error) {
      console.log(`  ✅ OLD query failed as expected: ${error.message}`);
    }
    
    // Test the NEW fixed query (should work)
    console.log('\n📊 Test 2: NEW fixed query (should work)');
    try {
      const newResult = await pool.query(
        'SELECT id, today_date FROM activity_data WHERE user_id = 2 AND DATE(today_date) = $1::date',
        [currentDate]
      );
      console.log(`  ✅ NEW query returned ${newResult.rows.length} rows`);
      if (newResult.rows.length > 0) {
        newResult.rows.forEach(row => {
          console.log(`    Found: ID ${row.id} | Date: ${row.today_date}`);
        });
      }
    } catch (error) {
      console.log(`  ❌ NEW query failed: ${error.message}`);
    }
    
    // Test with string date
    console.log('\n📊 Test 3: NEW query with string date');
    try {
      const stringResult = await pool.query(
        'SELECT id, today_date FROM activity_data WHERE user_id = 2 AND DATE(today_date) = $1::date',
        ['2025-08-26']
      );
      console.log(`  ✅ String date query returned ${stringResult.rows.length} rows`);
      if (stringResult.rows.length > 0) {
        stringResult.rows.forEach(row => {
          console.log(`    Found: ID ${row.id} | Date: ${row.today_date}`);
        });
      }
    } catch (error) {
      console.log(`  ❌ String date query failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testFixedQuery();
