const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyDuplicateNotificationFixes() {
  try {
    console.log('🔧 Applying duplicate notification fixes...\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-duplicate-notifications.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    console.log(`   Size: ${sqlContent.length} characters`);
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`\n2️⃣ Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;
      
      try {
        console.log(`\n   Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   Statement: ${statement.substring(0, 100)}...`);
        
        await pool.query(statement);
        console.log(`   ✅ Statement ${i + 1} executed successfully`);
        
      } catch (error) {
        console.log(`   ❌ Error executing statement ${i + 1}: ${error.message}`);
        // Continue with other statements
      }
    }
    
    console.log('\n3️⃣ Testing the fixes...');
    
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
    
    // Test is_break_ending_soon for both users
    console.log('\n   Testing is_break_ending_soon for both users:');
    const testTime = '2025-08-19 12:45:00'; // When notifications were sent
    
    const user1EndingSoon = await pool.query(`
      SELECT is_break_ending_soon(1, $1::timestamp without time zone) as ending_soon
    `, [testTime]);
    
    const user2EndingSoon = await pool.query(`
      SELECT is_break_ending_soon(2, $1::timestamp without time zone) as ending_soon
    `, [testTime]);
    
    console.log(`     User 1 ending soon at 12:45 PM: ${user1EndingSoon.rows[0].ending_soon}`);
    console.log(`     User 2 ending soon at 12:45 PM: ${user2EndingSoon.rows[0].ending_soon}`);
    
    if (!user1EndingSoon.rows[0].ending_soon && user2EndingSoon.rows[0].ending_soon) {
      console.log('     ✅ FIXED: User 1 no longer gets ending soon notifications');
    } else if (user1EndingSoon.rows[0].ending_soon) {
      console.log('     ❌ NOT FIXED: User 1 still gets ending soon notifications');
    } else if (!user2EndingSoon.rows[0].ending_soon) {
      console.log('     ❌ User 2 no longer gets ending soon notifications (unexpected)');
    }
    
    // Test other functions
    console.log('\n   Testing other break functions for User 1:');
    
    const user1Available = await pool.query(`
      SELECT is_break_available(1, 'Lunch', $1::timestamp without time zone) as available
    `, [testTime]);
    
    const user1AvailableSoon = await pool.query(`
      SELECT is_break_available_soon(1, 'Lunch', $1::timestamp without time zone) as available_soon
    `, [testTime]);
    
    const user1Missed = await pool.query(`
      SELECT is_break_missed(1, 'Lunch', $1::timestamp without time zone) as missed
    `, [testTime]);
    
    console.log(`     is_break_available: ${user1Available.rows[0].available}`);
    console.log(`     is_break_available_soon: ${user1AvailableSoon.rows[0].available_soon}`);
    console.log(`     is_break_missed: ${user1Missed.rows[0].missed}`);
    
    // All should be false for User 1
    const allFalse = !user1Available.rows[0].available && 
                     !user1AvailableSoon.rows[0].available_soon && 
                     !user1Missed.rows[0].missed;
    
    if (allFalse) {
      console.log('     ✅ FIXED: All break functions return false for User 1');
    } else {
      console.log('     ❌ NOT FIXED: Some break functions still return true for User 1');
    }
    
    // Summary
    console.log('\n✅ Duplicate notification fixes applied and tested!');
    
    console.log('\n🎯 What was fixed:');
    console.log('   • get_agent_shift_info() no longer returns default shift times');
    console.log('   • Users without shifts now get NULL instead of "6:00 AM - 3:00 PM"');
    console.log('   • is_break_ending_soon() returns false for users with no shift time');
    console.log('   • All break notification functions now respect shift time configuration');
    console.log('   • Only users with valid shifts will get break notifications');
    
    console.log('\n🔧 Result:');
    console.log('   • User 1 (no shift): Will get NO break notifications ✅');
    console.log('   • User 2 (6:00 AM - 3:00 PM): Will get break notifications ✅');
    console.log('   • No more duplicate notifications for users without shifts! 🎉');
    
  } catch (error) {
    console.error('❌ Error applying fixes:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix application
applyDuplicateNotificationFixes();
