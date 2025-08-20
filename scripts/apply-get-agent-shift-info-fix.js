const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyGetAgentShiftInfoFix() {
  try {
    console.log('🔧 Applying get_agent_shift_info fix...\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-get-agent-shift-info-only.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    
    // Execute the SQL
    console.log('\n2️⃣ Executing SQL fix...');
    await pool.query(sqlContent);
    console.log('   ✅ get_agent_shift_info function updated successfully');
    
    // Test the fix
    console.log('\n3️⃣ Testing the fix...');
    
    // Test User 1 (should now return null shift time)
    console.log('\n   Testing User 1 get_agent_shift_info:');
    const user1ShiftInfo = await pool.query(`
      SELECT * FROM get_agent_shift_info(1)
    `);
    
    if (user1ShiftInfo.rows.length > 0) {
      const user1 = user1ShiftInfo.rows[0];
      console.log(`     User 1 shift info: ${JSON.stringify(user1)}`);
      
      if (user1.shift_time === null) {
        console.log('     ✅ FIXED: User 1 now returns null shift time');
      } else {
        console.log('     ❌ NOT FIXED: User 1 still returns shift time');
      }
    }
    
    // Test User 2 (should still return shift time)
    console.log('\n   Testing User 2 get_agent_shift_info:');
    const user2ShiftInfo = await pool.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (user2ShiftInfo.rows.length > 0) {
      const user2 = user2ShiftInfo.rows[0];
      console.log(`     User 2 shift info: ${JSON.stringify(user2)}`);
      
      if (user2.shift_time === '6:00 AM - 3:00 PM') {
        console.log('     ✅ User 2 still returns correct shift time');
      } else {
        console.log('     ❌ User 2 shift time changed unexpectedly');
      }
    }
    
    // Summary
    console.log('\n✅ get_agent_shift_info fix applied and tested!');
    
    if (user1ShiftInfo.rows[0].shift_time === null && user2ShiftInfo.rows[0].shift_time === '6:00 AM - 3:00 PM') {
      console.log('\n🎯 SUCCESS: Function now correctly returns:');
      console.log('   • User 1 (no shift): NULL ✅');
      console.log('   • User 2 (with shift): "6:00 AM - 3:00 PM" ✅');
    } else {
      console.log('\n❌ ISSUE: Function still not working correctly');
    }
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix application
applyGetAgentShiftInfoFix();
