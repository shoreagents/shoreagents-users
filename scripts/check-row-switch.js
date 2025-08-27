const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkRowSwitch() {
  console.log('🔍 Checking Row Switch Status\n');
  
  try {
    // Get current date and tomorrow
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayDate = today.toISOString().split('T')[0];
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Today: ${todayDate}`);
    console.log(`📅 Tomorrow: ${tomorrowDate}`);
    
    // Check which row is currently active
    const activeRow = await pool.query(`
      SELECT 
        id, 
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
      console.log(`\n✅ Currently Active Row:`);
      console.log(`   • ID: ${row.id}`);
      console.log(`   • Date: ${row.today_date}`);
      console.log(`   • Active: ${row.today_active_seconds}s`);
      console.log(`   • Inactive: ${row.today_inactive_seconds}s`);
      console.log(`   • Last Updated: ${row.updated_at}`);
      
      if (row.today_date === todayDate) {
        console.log(`   • Status: Using TODAY's row (${todayDate})`);
        console.log(`   • Next: Will switch to tomorrow's row at 6:00 AM`);
      } else if (row.today_date === tomorrowDate) {
        console.log(`   • Status: Using TOMORROW's row (${tomorrowDate}) - SUCCESS!`);
        console.log(`   • Next: Timer should be counting from 0s`);
      } else {
        console.log(`   • Status: Using different date (${row.today_date})`);
      }
    } else {
      console.log('❌ No currently active row found');
    }
    
    // Check tomorrow's row status
    console.log('\n📋 Tomorrow\'s Row Status:');
    const tomorrowRow = await pool.query(`
      SELECT 
        id, 
        today_date, 
        today_active_seconds,
        today_inactive_seconds,
        is_currently_active,
        created_at
      FROM activity_data 
      WHERE today_date = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [tomorrowDate]);
    
    if (tomorrowRow.rows.length > 0) {
      const row = tomorrowRow.rows[0];
      console.log(`✅ Tomorrow's Row Found:`);
      console.log(`   • ID: ${row.id}`);
      console.log(`   • Date: ${row.today_date}`);
      console.log(`   • Active: ${row.today_active_seconds}s`);
      console.log(`   • Inactive: ${row.today_inactive_seconds}s`);
      console.log(`   • Currently Active: ${row.is_currently_active}`);
      console.log(`   • Created: ${row.created_at}`);
      
      if (row.is_currently_active) {
        console.log(`   • Status: TOMORROW's row is now ACTIVE! 🎉`);
      } else {
        console.log(`   • Status: Ready to be activated at 6:00 AM tomorrow`);
      }
    } else {
      console.log('❌ Tomorrow\'s row not found');
    }
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log('🎯 To verify tomorrow\'s row usage:');
    console.log('1. Run this script again at 6:00 AM tomorrow');
    console.log('2. Check if "Currently Active Row" shows tomorrow\'s date');
    console.log('3. Verify "Tomorrow\'s Row Status" shows "Currently Active: true"');
    console.log('4. Confirm timer starts from 0s in the frontend');
    
  } catch (error) {
    console.error('❌ Check failed:', error);
  } finally {
    await pool.end();
  }
}

checkRowSwitch();
