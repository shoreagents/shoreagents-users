const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixDuplicateFunctionsFinal() {
  console.log('🧹 Final Cleanup of Duplicate and Unnecessary Functions\n');
  
  try {
    // 1. First, let's check the current state
    console.log('1️⃣ Checking current function state...');
    const duplicateCheck = await pool.query(`
      SELECT 
        proname,
        proargtypes::regtype[] as arg_types,
        oid,
        prosrc
      FROM pg_proc 
      WHERE proname = 'is_break_window_ending_soon'
      ORDER BY oid
    `);

    if (duplicateCheck.rows.length !== 2) {
      console.log('   ❌ Expected 2 functions, found:', duplicateCheck.rows.length);
      return;
    }

    const func1 = duplicateCheck.rows[0];
    const func2 = duplicateCheck.rows[1];
    
    console.log(`   Found 2 functions:`);
    const argTypes1 = Array.isArray(func1.arg_types) ? func1.arg_types.join(', ') : func1.arg_types.toString();
    const argTypes2 = Array.isArray(func2.arg_types) ? func2.arg_types.join(', ') : func2.arg_types.toString();
    console.log(`      Function 1 (OID: ${func1.oid}): ${argTypes1}`);
    console.log(`      Function 2 (OID: ${func2.oid}): ${argTypes2}`);

    // 2. Determine which one to keep
    let keepFunc, removeFunc;
    if (argTypes1.includes('timestamp without time zone')) {
      keepFunc = func1;
      removeFunc = func2;
      console.log('   ✅ Keeping function with timestamp without time zone (more common usage)');
    } else {
      keepFunc = func2;
      removeFunc = func1;
      console.log('   ✅ Keeping function with timestamp with time zone');
    }

    // 3. Remove the duplicate function
    console.log('\n2️⃣ Removing duplicate function...');
    await pool.query(`DROP FUNCTION IF EXISTS ${removeFunc.proname}(${argTypes2.includes('timestamp with time zone') ? 'integer, break_type_enum, timestamp with time zone' : 'integer, break_type_enum, timestamp without time zone'})`);
    console.log(`   ✅ Removed duplicate function (OID: ${removeFunc.oid})`);

    // 4. Check if we can remove potentially unused functions
    console.log('\n3️⃣ Checking potentially unused functions...');
    
    // Check if is_break_available is actually used
    const isBreakAvailableUsage = await pool.query(`
      SELECT COUNT(*) as usage_count
      FROM pg_stat_statements 
      WHERE query LIKE '%is_break_available%'
    `).catch(() => ({ rows: [{ usage_count: 0 }] }));

    if (isBreakAvailableUsage.rows[0].usage_count === 0) {
      console.log('   🤔 is_break_available appears unused - checking if safe to remove...');
      
      // Check if it's referenced in any other functions
      const references = await pool.query(`
        SELECT prosrc FROM pg_proc 
        WHERE prosrc LIKE '%is_break_available%'
        AND proname != 'is_break_available'
      `);
      
      if (references.rows.length === 0) {
        console.log('   🗑️  No references found - removing is_break_available...');
        await pool.query(`DROP FUNCTION IF EXISTS is_break_available(integer, break_type_enum, timestamp without time zone)`);
        console.log('   ✅ Removed is_break_available');
      } else {
        console.log('   ⚠️  is_break_available is referenced in other functions - keeping it');
      }
    } else {
      console.log('   ✅ is_break_available is being used - keeping it');
    }

    // Check if is_break_available_now_notification_sent is actually used
    const notificationSentUsage = await pool.query(`
      SELECT COUNT(*) as usage_count
      FROM pg_stat_statements 
      WHERE query LIKE '%is_break_available_now_notification_sent%'
    `).catch(() => ({ rows: [{ usage_count: 0 }] }));

    if (notificationSentUsage.rows[0].usage_count === 0) {
      console.log('   🤔 is_break_available_now_notification_sent appears unused - checking if safe to remove...');
      
      // Check if it's referenced in any other functions
      const references = await pool.query(`
        SELECT prosrc FROM pg_proc 
        WHERE prosrc LIKE '%is_break_available_now_notification_sent%'
        AND proname != 'is_break_available_now_notification_sent'
      `);
      
      if (references.rows.length === 0) {
        console.log('   🗑️  No references found - removing is_break_available_now_notification_sent...');
        await pool.query(`DROP FUNCTION IF EXISTS is_break_available_now_notification_sent(integer, break_type_enum, timestamp without time zone)`);
        console.log('   ✅ Removed is_break_available_now_notification_sent');
      } else {
        console.log('   ⚠️  is_break_available_now_notification_sent is referenced in other functions - keeping it');
      }
    } else {
      console.log('   ✅ is_break_available_now_notification_sent is being used - keeping it');
    }

    // 5. Verify the cleanup
    console.log('\n4️⃣ Verifying cleanup...');
    const finalCheck = await pool.query(`
      SELECT 
        proname,
        COUNT(*) as count
      FROM pg_proc 
      WHERE proname IN ('is_break_window_ending_soon', 'is_break_available', 'is_break_available_now_notification_sent')
      GROUP BY proname
      ORDER BY proname
    `);

    finalCheck.rows.forEach(row => {
      if (row.proname === 'is_break_window_ending_soon' && row.count === 1) {
        console.log(`   ✅ ${row.proname}: Now has only 1 signature (duplicate removed)`);
      } else if (row.count === 0) {
        console.log(`   ✅ ${row.proname}: Successfully removed`);
      } else {
        console.log(`   ⚠️  ${row.proname}: Still has ${row.count} signatures`);
      }
    });

    // 6. Test that the remaining function works
    console.log('\n5️⃣ Testing remaining function...');
    try {
      const testResult = await pool.query(`
        SELECT is_break_window_ending_soon(1, 'Morning'::break_type_enum, NOW()::timestamp without time zone) as result
      `);
      console.log(`   ✅ Function test successful: ${testResult.rows[0].result}`);
    } catch (error) {
      console.log(`   ❌ Function test failed: ${error.message}`);
    }

    console.log('\n🎉 Cleanup completed successfully!');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await pool.end();
  }
}

fixDuplicateFunctionsFinal();
