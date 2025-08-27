const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testCorrectedFunction() {
  try {
    console.log('🧪 Testing Corrected Activity Reset Function...');
    
    // Check current time
    const now = new Date();
    console.log(`⏰ Current UTC time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Check current activity data
    console.log('\n📊 Current activity data:');
    const currentData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY today_date DESC
      LIMIT 3
    `);
    
    console.log('📋 Recent activity records:');
    currentData.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    });
    
    // Test the corrected function
    console.log('\n🔄 Testing corrected_activity_reset() function...');
    const result = await pool.query('SELECT corrected_activity_reset() AS reset_count');
    
    console.log(`✅ Function result: ${result.rows[0].reset_count} resets performed`);
    
    // Check activity data after function call
    console.log('\n📊 Activity data after function call:');
    const afterData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        updated_at
      FROM activity_data 
      WHERE user_id = 2 
      ORDER BY today_date DESC
      LIMIT 3
    `);
    
    console.log('📋 Activity records after function:');
    afterData.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s`);
    });
    
    // Check if any changes were made
    const changes = [];
    for (let i = 0; i < currentData.rows.length; i++) {
      const before = currentData.rows[i];
      const after = afterData.rows[i];
      if (before.today_active_seconds !== after.today_active_seconds || 
          before.today_inactive_seconds !== after.today_inactive_seconds) {
        changes.push({
          date: before.today_date,
          before: { active: before.today_active_seconds, inactive: before.today_inactive_seconds },
          after: { active: after.today_active_seconds, inactive: after.today_inactive_seconds }
        });
      }
    }
    
    if (changes.length > 0) {
      console.log('\n🔄 Changes detected:');
      changes.forEach(change => {
        console.log(`  Date: ${change.date}`);
        console.log(`    Active: ${change.before.active}s → ${change.after.active}s`);
        console.log(`    Inactive: ${change.before.inactive}s → ${change.after.inactive}s`);
      });
    } else {
      console.log('\n✅ No changes detected - function did not modify any data');
    }
    
  } catch (error) {
    console.error('❌ Error testing function:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testCorrectedFunction();
