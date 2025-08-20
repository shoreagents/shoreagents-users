const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkBreakWindows() {
  try {
    console.log('🔍 Checking Break Windows for 6:00 AM - 3:00 PM Shift...\n');
    
    const result = await pool.query(`
      SELECT * FROM calculate_break_windows('6:00 AM - 3:00 PM')
    `);
    
    const windows = result.rows[0];
    console.log('📋 Break Windows:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   🌅 Morning Break: ${windows.morning_start} - ${windows.morning_end}`);
    console.log(`   🍽️  Lunch Break: ${windows.lunch_start} - ${windows.lunch_end}`);
    console.log(`   🌆 Afternoon Break: ${windows.afternoon_start} - ${windows.afternoon_end}`);
    
    console.log('\n⏰ Notification Timing:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   📢 7:45 AM: Morning break available soon (15 min before ${windows.morning_start})`);
    console.log(`   📢 8:00 AM: Morning break available (break starts)`);
    console.log(`   ⏰ 9:45 AM: Morning break ending soon (15 min before ${windows.morning_end})`);
    console.log(`   📢 10:15 AM: Lunch break available soon (15 min before ${windows.lunch_start})`);
    console.log(`   📢 10:30 AM: Lunch break available (break starts)`);
    console.log(`   ⏰ 11:15 AM: Lunch break ending soon (15 min before ${windows.lunch_end})`);
    console.log(`   📢 12:45 PM: Afternoon break available soon (15 min before ${windows.afternoon_start})`);
    console.log(`   📢 1:00 PM: Afternoon break available (break starts)`);
    console.log(`   ⏰ 2:45 PM: Afternoon break ending soon (15 min before ${windows.afternoon_end})`);
    
    console.log('\n🎯 Test these times:');
    console.log('   node scripts/test-break-time.js "7:45 AM"   # Morning break soon');
    console.log('   node scripts/test-break-time.js "10:15 AM"  # Lunch break soon');
    console.log('   node scripts/test-break-time.js "12:45 PM"  # Afternoon break soon');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBreakWindows();
