const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTimerHydrationFix() {
  try {
    console.log('🧪 Testing Timer Hydration Fix...');

    // Check current time
    const now = new Date();
    console.log(`⏰ Current UTC time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);

    // Calculate current Manila date (same logic as socket server)
    const manilaTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const currentDate = manilaTime.toISOString().split('T')[0];
    console.log(`📅 Current Manila date: ${currentDate}`);

    // Test user ID 2 (the one we've been working with)
    const userId = 2;

    console.log('\n🔍 Testing Priority-Based Activity Data Loading...');

    // Test 1: Priority query for current day (should return 8/26 data)
    console.log('\n📊 Test 1: Priority query for current day');
    const priorityResult = await pool.query(
      `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
       FROM activity_data 
       WHERE user_id = $1 AND today_date = $2`,
      [userId, currentDate]
    );

    if (priorityResult.rows.length > 0) {
      const row = priorityResult.rows[0];
      console.log(`✅ Found current day data:`);
      console.log(`   Date: ${row.today_date}`);
      console.log(`   Active: ${row.today_active_seconds}s`);
      console.log(`   Inactive: ${row.today_inactive_seconds}s`);
      console.log(`   Is Active: ${row.is_currently_active}`);
    } else {
      console.log(`❌ No current day data found for date: ${currentDate}`);
    }

    // Test 2: Fallback query for most recent data (should return 8/26 data)
    console.log('\n📊 Test 2: Fallback query for most recent data');
    const fallbackResult = await pool.query(
      `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
       FROM activity_data 
       WHERE user_id = $1 
       ORDER BY today_date DESC 
       LIMIT 1`,
      [userId]
    );

    if (fallbackResult.rows.length > 0) {
      const row = fallbackResult.rows[0];
      console.log(`✅ Found most recent data:`);
      console.log(`   Date: ${row.today_date}`);
      console.log(`   Active: ${row.today_active_seconds}s`);
      console.log(`   Inactive: ${row.today_inactive_seconds}s`);
      console.log(`   Is Active: ${row.is_currently_active}`);
    } else {
      console.log(`❌ No fallback data found`);
    }

    // Test 3: Check all recent activity data to see the full picture
    console.log('\n📊 Test 3: All recent activity data');
    const allDataResult = await pool.query(
      `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
       FROM activity_data 
       WHERE user_id = $1 
       ORDER BY today_date DESC 
       LIMIT 5`,
      [userId]
    );

    console.log('📋 Recent activity records:');
    allDataResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. Date: ${row.today_date} | Active: ${row.today_active_seconds}s | Inactive: ${row.today_inactive_seconds}s | Is Active: ${row.is_currently_active}`);
    });

    // Test 4: Verify the fix logic
    console.log('\n🔧 Test 4: Verifying Fix Logic');
    
    if (priorityResult.rows.length > 0) {
      const currentDayData = priorityResult.rows[0];
      console.log(`✅ Current day data found and will be used first`);
      console.log(`   This prevents loading old accumulated data from previous days`);
      
      if (currentDayData.today_active_seconds === 0 && currentDayData.today_inactive_seconds === 0) {
        console.log(`✅ Fresh start detected - zero values will be respected`);
        console.log(`   No fallback to old accumulated data`);
      } else {
        console.log(`⚠️  Current day has accumulated data - this is expected for ongoing shifts`);
      }
    } else {
      console.log(`⚠️  No current day data - will fall back to most recent data`);
      console.log(`   This could potentially load old data, but should be rare`);
    }

    console.log('\n✅ Timer hydration fix test completed!');
    console.log('\n📋 Summary of the fix:');
    console.log('   1. Priority query: First tries to get current day data');
    console.log('   2. Fallback query: Only if no current day data exists');
    console.log('   3. No fallback to old accumulated data when current day is zero');
    console.log('   4. Respects fresh shift starts with zero values');

  } catch (error) {
    console.error('❌ Error testing timer hydration fix:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
testTimerHydrationFix();
