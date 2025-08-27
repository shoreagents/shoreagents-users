const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTomorrowRowUsage() {
  console.log('🧪 Testing Tomorrow Row Usage\n');
  
  try {
    // Step 1: Check current date and tomorrow's date
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayDate = today.toISOString().split('T')[0];
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Today: ${todayDate}`);
    console.log(`📅 Tomorrow: ${tomorrowDate}`);
    
    // Step 2: Check all rows for both dates
    console.log('\n📋 Step 2: Checking all rows for both dates...');
    
    const allRows = await pool.query(`
      SELECT 
        id, 
        user_id, 
        today_date, 
        created_at,
        updated_at,
        today_active_seconds,
        today_inactive_seconds,
        is_currently_active
      FROM activity_data 
      WHERE today_date IN ($1, $2)
      ORDER BY today_date DESC, created_at DESC
    `, [todayDate, tomorrowDate]);
    
    console.log(`📊 Found ${allRows.rows.length} rows:`);
    allRows.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}`);
      console.log(`      • Date: ${row.today_date}`);
      console.log(`      • Created: ${row.created_at}`);
      console.log(`      • Updated: ${row.updated_at}`);
      console.log(`      • Active: ${row.today_active_seconds}s`);
      console.log(`      • Inactive: ${row.today_inactive_seconds}s`);
      console.log(`      • Currently Active: ${row.is_currently_active}`);
      console.log('');
    });
    
    // Step 3: Check which row is currently being used
    console.log('📋 Step 3: Checking which row is currently active...');
    
    const activeRow = await pool.query(`
      SELECT 
        id, 
        user_id, 
        today_date, 
        today_active_seconds,
        today_inactive_seconds,
        is_currently_active,
        updated_at
      FROM activity_data 
      WHERE is_currently_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    
    if (activeRow.rows.length > 0) {
      const row = activeRow.rows[0];
      console.log(`✅ Currently Active Row:`);
      console.log(`   • ID: ${row.id}`);
      console.log(`   • Date: ${row.today_date}`);
      console.log(`   • Active: ${row.today_active_seconds}s`);
      console.log(`   • Inactive: ${row.today_inactive_seconds}s`);
      console.log(`   • Last Updated: ${row.updated_at}`);
      
      if (row.today_date === todayDate) {
        console.log(`   • Status: Using TODAY's row (${todayDate})`);
      } else if (row.today_date === tomorrowDate) {
        console.log(`   • Status: Using TOMORROW's row (${tomorrowDate}) - This is what we want!`);
      } else {
        console.log(`   • Status: Using different date (${row.today_date})`);
      }
    } else {
      console.log('❌ No currently active row found');
    }
    
    // Step 4: Test the shift detection logic
    console.log('\n📋 Step 4: Testing shift detection logic...');
    
    const currentTime = new Date();
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    
    console.log(`⏰ Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
    console.log(`⏰ Current minutes since midnight: ${currentMinutes}`);
    
    // Check if we're within shift time (6:00 AM - 1:48 PM)
    const shiftStartMinutes = 6 * 60; // 6:00 AM
    const shiftEndMinutes = 13 * 60 + 48; // 1:48 PM
    
    console.log(`🕐 Shift time: 6:00 AM (${shiftStartMinutes} min) - 1:48 PM (${shiftEndMinutes} min)`);
    
    if (currentMinutes >= shiftStartMinutes && currentMinutes <= shiftEndMinutes) {
      console.log(`✅ Currently within shift window`);
    } else {
      console.log(`❌ Currently outside shift window`);
    }
    
    // Step 5: Summary and next steps
    console.log('\n📋 Step 5: Test Summary');
    console.log('🎯 To test if tomorrow\'s row is being used:');
    console.log('1. Wait until 6:00 AM tomorrow');
    console.log('2. Check if the system switches to tomorrow\'s row');
    console.log('3. Verify timer starts counting from 0s');
    console.log('4. Confirm real-time updates work');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testTomorrowRowUsage();
