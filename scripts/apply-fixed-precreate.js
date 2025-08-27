const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyFixedPrecreate() {
  console.log('🔧 Applying Fixed Precreate Function\n');
  
  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'fix-precreate-function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📖 SQL content loaded, applying to database...');
    
    // Apply the function
    await pool.query(sqlContent);
    console.log('✅ Fixed precreate function applied successfully');
    
    // Test the function
    console.log('\n🧪 Testing the fixed function...');
    const testResult = await pool.query(`
      SELECT precreate_next_day_activity_rows() AS created
    `);
    
    const created = testResult.rows[0]?.created || 0;
    console.log(`📊 Function result: ${created} rows created`);
    
    if (created > 0) {
      console.log('🎉 SUCCESS! The function is now working and creating new rows!');
    } else {
      console.log('ℹ️ No new rows created (this might be correct if rows already exist)');
    }
    
    // Check current activity data to see if new rows were created
    console.log('\n📋 Checking current activity data...');
    const currentData = await pool.query(`
      SELECT id, user_id, today_active_seconds, today_inactive_seconds, 
             is_currently_active, today_date, created_at, updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Current activity rows (${currentData.rows.length} total):`);
    currentData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
    });
    
  } catch (error) {
    console.error('❌ Error applying fixed function:', error);
  } finally {
    await pool.end();
  }
}

applyFixedPrecreate();
