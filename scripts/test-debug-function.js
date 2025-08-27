const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testDebugFunction() {
  console.log('🧪 Testing Debug Function\n');
  
  try {
    // Step 1: Apply the debug function
    console.log('📋 Step 1: Applying debug function...');
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'debug-function-step-by-step.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sqlContent);
    console.log('✅ Debug function applied successfully');
    
    // Step 2: Test the debug function
    console.log('\n📋 Step 2: Testing debug function...');
    console.log('🔍 This will show detailed step-by-step execution...');
    
    const testResult = await pool.query(`
      SELECT precreate_next_day_activity_rows_debug() AS created
    `);
    
    const created = testResult.rows[0]?.created || 0;
    console.log(`\n📊 Function result: ${created} rows created`);
    
    // Step 3: Check if any new rows were created
    console.log('\n📋 Step 3: Checking for new rows...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    const checkResult = await pool.query(`
      SELECT id, user_id, today_date, created_at
      FROM activity_data 
      WHERE today_date = $1
      ORDER BY created_at DESC
    `, [tomorrowDate]);
    
    console.log(`📊 Rows for ${tomorrowDate}: ${checkResult.rows.length}`);
    if (checkResult.rows.length > 0) {
      console.log('✅ Found rows for tomorrow:');
      checkResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}, User: ${row.user_id}, Created: ${row.created_at}`);
      });
    } else {
      console.log('❌ No rows found for tomorrow');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testDebugFunction();
