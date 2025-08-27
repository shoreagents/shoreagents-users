const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAllRecentRows() {
  try {
    console.log('🔍 Checking ALL recent rows in activity_data...');
    
    // Get all activity data for user 2, ordered by creation time
    const allData = await pool.query(
      'SELECT id, user_id, today_date, today_active_seconds, today_inactive_seconds, created_at, updated_at FROM activity_data WHERE user_id = 2 ORDER BY created_at DESC'
    );
    
    console.log(`\n📋 Found ${allData.rows.length} total rows for user 2:`);
    allData.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s | Created: ${row.created_at} | Updated: ${row.updated_at}`);
    });
    
    // Check if there are any rows with recent timestamps
    console.log('\n🔍 Checking for rows created in the last hour...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRows = await pool.query(
      'SELECT id, user_id, today_date, today_active_seconds, today_inactive_seconds, created_at, updated_at FROM activity_data WHERE user_id = 2 AND created_at > $1 ORDER BY created_at DESC',
      [oneHourAgo]
    );
    
    if (recentRows.rows.length > 0) {
      console.log(`✅ Found ${recentRows.rows.length} recent rows:`);
      recentRows.rows.forEach(row => {
        console.log(`  ID: ${row.id} | Date: ${row.today_date} | Created: ${row.created_at}`);
      });
    } else {
      console.log('❌ No rows created in the last hour');
    }
    
    // Check the database schema to understand the table structure
    console.log('\n🔍 Checking table schema...');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'activity_data' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table schema:');
    schemaResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllRecentRows();
