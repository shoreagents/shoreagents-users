const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyIsBreakEndingSoonFix() {
  try {
    console.log('🔧 Applying is_break_ending_soon fix...\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-is-break-ending-soon-only.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    
    // Execute the SQL
    console.log('\n2️⃣ Executing SQL fix...');
    await pool.query(sqlContent);
    console.log('   ✅ is_break_ending_soon function updated successfully');
    
    // Test the fix
    console.log('\n3️⃣ Testing the fix...');
    
    const testTime = '2025-08-19 12:45:00'; // When notifications were sent
    
    // Test User 1 (should now return false - no shift time)
    console.log('\n   Testing User 1 is_break_ending_soon:');
    const user1EndingSoon = await pool.query(`
      SELECT is_break_ending_soon(1, $1::timestamp without time zone) as ending_soon
    `, [testTime]);
    
    console.log(`     User 1 ending soon at 12:45 PM: ${user1EndingSoon.rows[0].ending_soon}`);
    
    if (!user1EndingSoon.rows[0].ending_soon) {
      console.log('     ✅ FIXED: User 1 no longer gets ending soon notifications');
    } else {
      console.log('     ❌ NOT FIXED: User 1 still gets ending soon notifications');
    }
    
    // Test User 2 (should still return true - has shift time)
    console.log('\n   Testing User 2 is_break_ending_soon:');
    const user2EndingSoon = await pool.query(`
      SELECT is_break_ending_soon(2, $1::timestamp without time zone) as ending_soon
    `, [testTime]);
    
    console.log(`     User 2 ending soon at 12:45 PM: ${user2EndingSoon.rows[0].ending_soon}`);
    
    if (user2EndingSoon.rows[0].ending_soon) {
      console.log('     ✅ User 2 still gets ending soon notifications (correct)');
    } else {
      console.log('     ❌ User 2 no longer gets ending soon notifications (unexpected)');
    }
    
    // Test at a different time when no breaks are ending
    console.log('\n   Testing at 2:00 PM (no breaks ending):');
    const testTime2 = '2025-08-19 14:00:00';
    
    const user1EndingSoon2 = await pool.query(`
      SELECT is_break_ending_soon(1, $1::timestamp without time zone) as ending_soon
    `, [testTime2]);
    
    const user2EndingSoon2 = await pool.query(`
      SELECT is_break_ending_soon(2, $1::timestamp without time zone) as ending_soon
    `, [testTime2]);
    
    console.log(`     User 1 ending soon at 2:00 PM: ${user1EndingSoon2.rows[0].ending_soon}`);
    console.log(`     User 2 ending soon at 2:00 PM: ${user2EndingSoon2.rows[0].ending_soon}`);
    
    // Summary
    console.log('\n✅ is_break_ending_soon fix applied and tested!');
    
    if (!user1EndingSoon.rows[0].ending_soon && user2EndingSoon.rows[0].ending_soon) {
      console.log('\n🎯 SUCCESS: Function now correctly returns:');
      console.log('   • User 1 (no shift): FALSE ✅');
      console.log('   • User 2 (with shift): TRUE ✅');
      console.log('   • No more duplicate notifications for users without shifts! 🎉');
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
applyIsBreakEndingSoonFix();
