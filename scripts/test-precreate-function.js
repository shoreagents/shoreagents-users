const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testPrecreateFunction() {
  console.log('🧪 Testing precreate_next_day_activity_rows Function\n');
  
  try {
    // Step 1: Check current activity data
    console.log('📋 Step 1: Checking current activity data...');
    const currentData = await pool.query(`
      SELECT id, user_id, today_active_seconds, today_inactive_seconds, 
             is_currently_active, today_date, created_at, updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${currentData.rows.length} activity rows:`);
    currentData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
    });
    
    // Step 2: Check if tomorrow's row already exists
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`\n📋 Step 2: Checking if row for ${tomorrowDate} exists...`);
    const tomorrowCheck = await pool.query(`
      SELECT id, user_id, today_date 
      FROM activity_data 
      WHERE user_id = 2 AND today_date = $1
    `, [tomorrowDate]);
    
    if (tomorrowCheck.rows.length > 0) {
      console.log(`⚠️ Row for ${tomorrowDate} already exists (ID: ${tomorrowCheck.rows[0].id})`);
    } else {
      console.log(`✅ No row exists for ${tomorrowDate} - should be created by precreate function`);
    }
    
    // Step 3: Test the precreate function
    console.log('\n📋 Step 3: Testing precreate_next_day_activity_rows function...');
    const precreateResult = await pool.query(`
      SELECT precreate_next_day_activity_rows() AS created
    `);
    
    const created = precreateResult.rows[0]?.created || 0;
    console.log(`📊 Function result: ${created} rows created`);
    
    // Step 4: Check if new rows were created
    console.log('\n📋 Step 4: Checking if new rows were created...');
    const afterData = await pool.query(`
      SELECT id, user_id, today_active_seconds, today_inactive_seconds, 
             is_currently_active, today_date, created_at, updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📊 After precreate: ${afterData.rows.length} activity rows:`);
    afterData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. Date: ${row.today_date}, Active: ${row.today_active_seconds}s, Inactive: ${row.today_inactive_seconds}s`);
    });
    
    // Step 5: Check the function logic
    console.log('\n📋 Step 5: Checking function logic...');
    console.log('🔍 The function should create new rows when:');
    console.log('   1. Current time is after shift end time');
    console.log('   2. No row exists for the next day');
    console.log('   3. Agent has a valid shift schedule');
    
    // Step 6: Check current time vs shift end time
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
    console.log(`\n⏰ Current time: ${now.toLocaleTimeString()} (${currentTime} minutes since midnight)`);
    console.log(`📅 Shift end time: 1:23 PM (803 minutes since midnight)`);
    console.log(`🔍 After shift end: ${currentTime > 803 ? 'YES' : 'NO'}`);
    
    if (currentTime > 803) {
      console.log('✅ Current time is after shift end - function should create new rows');
    } else {
      console.log('❌ Current time is before shift end - function will not create new rows yet');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testPrecreateFunction();
