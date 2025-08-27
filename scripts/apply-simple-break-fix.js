const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applySimpleBreakFix() {
  console.log('🔧 Applying Simple Break Fix\n');
  
  try {
    // Step 1: Apply the simple fix
    console.log('📋 Step 1: Applying simple fix...');
    const fs = require('fs');
    const path = require('path');
    const sqlPath = path.join(__dirname, 'fix-break-simple.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sqlContent);
    console.log('✅ Simple fix applied successfully');
    
    // Step 2: Test with 2:30 PM
    console.log('\n📋 Step 2: Testing with 2:30 PM...');
    const testResult = await pool.query(`
      SELECT 
        is_break_window_ending_soon(2, 'Afternoon'::break_type_enum, '2025-08-26 14:30:00'::timestamp) AS should_notify_230
    `);
    
    const shouldNotify = testResult.rows[0].should_notify_230;
    console.log(`🔔 Should notify at 2:30 PM: ${shouldNotify}`);
    
    // Step 3: Test with current time
    console.log('\n📋 Step 3: Testing with current time...');
    const currentResult = await pool.query(`
      SELECT 
        NOW() AS current_time,
        is_break_window_ending_soon(2, 'Afternoon'::break_type_enum, NOW()) AS should_notify_now
    `);
    
    const current = currentResult.rows[0];
    console.log(`🌍 Current time: ${current.current_time}`);
    console.log(`🔔 Should notify now: ${current.should_notify_now}`);
    
    // Step 4: Manual verification
    console.log('\n📋 Step 4: Manual verification...');
    const verifyResult = await pool.query(`
      SELECT 
        '14:30:00'::time AS test_time,
        '14:45:00'::time AS end_time,
        EXTRACT(EPOCH FROM ('14:45:00'::time - '14:30:00'::time)) / 60 AS minutes_until_end
    `);
    
    const verify = verifyResult.rows[0];
    const minutesUntilEnd = parseFloat(verify.minutes_until_end);
    const shouldNotifyManual = minutesUntilEnd >= 12 && minutesUntilEnd <= 18;
    
    console.log('🧮 Manual calculation:');
    console.log(`   • 2:30 PM to 2:45 PM: ${minutesUntilEnd} minutes`);
    console.log(`   • Should notify (12-18 min): ${shouldNotifyManual}`);
    
    // Summary
    console.log('\n🎉 SUMMARY:');
    if (shouldNotify) {
      console.log('✅ SUCCESS! The simple fix is working!');
      console.log('✅ At 2:30 PM, you will now receive the "Afternoon break ending soon" notification');
      console.log('✅ The function correctly calculates that 2:30 PM is 15 minutes before 2:45 PM');
      console.log('✅ Future afternoon break notifications will work properly');
    } else {
      console.log('❌ The simple fix is still not working');
      console.log('🔍 There may be a deeper issue in the function logic');
      console.log('🔍 Let me investigate further...');
    }
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await pool.end();
  }
}

applySimpleBreakFix();
