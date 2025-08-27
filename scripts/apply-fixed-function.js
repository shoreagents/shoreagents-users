const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyFixedFunction() {
  console.log('🔧 Applying Fixed Precreate Function\n');
  
  try {
    // Step 1: Apply the fixed function
    console.log('📋 Step 1: Applying fixed function...');
    const sqlPath = path.join(__dirname, 'fix-precreate-function-final.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sqlContent);
    console.log('✅ Fixed function applied successfully');
    
    // Step 2: Test the fixed function
    console.log('\n📋 Step 2: Testing the fixed function...');
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
    
    // Step 3: Check if new rows were actually created
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`\n📋 Step 3: Checking for rows created on ${tomorrowDate}...`);
    
    const checkResult = await pool.query(`
      SELECT id, user_id, today_date, created_at
      FROM activity_data 
      WHERE today_date = $1
      ORDER BY created_at DESC
    `, [tomorrowDate]);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ No rows found for tomorrow - function still not working');
    } else {
      console.log(`✅ Found ${checkResult.rows.length} rows for tomorrow:`);
      checkResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}, User: ${row.user_id}, Created: ${row.created_at}`);
      });
    }
    
    // Step 4: Test with a specific time to simulate shift end
    console.log('\n📋 Step 4: Testing with specific time (simulating shift end)...');
    
    // Test with a time that should definitely be after shift end
    const testTime = new Date();
    testTime.setHours(14, 0, 0, 0); // 2:00 PM
    
    const specificTestResult = await pool.query(`
      SELECT precreate_next_day_activity_rows($1) AS created
    `, [testTime]);
    
    const specificCreated = specificTestResult.rows[0]?.created || 0;
    console.log(`📊 Function result with specific time: ${specificCreated} rows created`);
    
  } catch (error) {
    console.error('❌ Error applying fixed function:', error);
  } finally {
    await pool.end();
  }
}

applyFixedFunction();
