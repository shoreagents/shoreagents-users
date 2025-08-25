const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanupDuplicateFunctionsAnalysis() {
  console.log('🧹 Break Function Analysis and Cleanup\n');
  
  try {
    // 1. Check current state of all break functions
    console.log('1️⃣ Current Function Status:');
    const allFunctions = await pool.query(`
      SELECT 
        proname,
        COUNT(*) as count,
        array_agg(DISTINCT proargtypes::regtype[] ORDER BY proargtypes::regtype[]) as signatures
      FROM pg_proc 
      WHERE proname LIKE '%break%'
      GROUP BY proname
      ORDER BY proname
    `);

    allFunctions.rows.forEach(row => {
      let signatures = '';
      if (Array.isArray(row.signatures)) {
        signatures = row.signatures.map(sig => 
          Array.isArray(sig) ? sig.join(', ') : sig.toString()
        ).join(' | ');
      } else {
        signatures = row.signatures ? row.signatures.toString() : 'N/A';
      }
      
      if (row.count === 1) {
        console.log(`   ✅ ${row.proname}: 1 signature`);
      } else {
        console.log(`   ⚠️  ${row.proname}: ${row.count} signatures`);
        console.log(`      Signatures: ${signatures}`);
      }
    });

    // 2. Identify which functions are actually needed
    console.log('\n2️⃣ Function Usage Analysis:');
    
    const neededFunctions = [
      'is_break_available_now',        // Used for "break is now available" notifications
      'is_break_available_soon',       // Used for "break available in 15 minutes" notifications  
      'is_break_window_ending_soon',   // Used for "break ending in 15 minutes" notifications
      'is_break_reminder_due',         // Used for reminder notifications
      'is_break_missed',               // Used for missed break notifications
      'is_break_ending_soon'           // Used for "break ending in 5 minutes" notifications
    ];

    const potentiallyUnused = [
      'is_break_available',                    // Generic availability check - may be redundant
      'is_break_available_now_notification_sent' // Tracks notification state - may be internal
    ];

    console.log('   ✅ Essential functions:');
    neededFunctions.forEach(func => console.log(`      - ${func}`));
    
    console.log('\n   🤔 Potentially unused functions:');
    potentiallyUnused.forEach(func => console.log(`      - ${func}`));

    // 3. Check for the specific duplicate issue
    console.log('\n3️⃣ Duplicate Function Issue:');
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

    if (duplicateCheck.rows.length === 2) {
      const func1 = duplicateCheck.rows[0];
      const func2 = duplicateCheck.rows[1];
      
      console.log('   ⚠️  Found duplicate is_break_window_ending_soon functions:');
      const argTypes1 = Array.isArray(func1.arg_types) ? func1.arg_types.join(', ') : func1.arg_types.toString();
      const argTypes2 = Array.isArray(func2.arg_types) ? func2.arg_types.join(', ') : func2.arg_types.toString();
      console.log(`      Function 1 (OID: ${func1.oid}): ${argTypes1}`);
      console.log(`      Function 2 (OID: ${func2.oid}): ${argTypes2}`);
      
      // Check if they're functionally identical
      if (func1.prosrc === func2.prosrc) {
        console.log('      ✅ Functions have identical source code');
        console.log('      💡 This is PostgreSQL function overloading (normal behavior)');
        console.log('      🚫 No cleanup needed - both functions are valid');
      } else {
        console.log('      ❌ Functions have different source code');
        console.log('      🚨 This is a problem - functions should be identical');
        console.log('      🧹 Cleanup needed - remove one duplicate');
      }
    }

    // 4. Recommendations
    console.log('\n4️⃣ Recommendations:');
    console.log('   🎯 Keep these essential functions:');
    neededFunctions.forEach(func => console.log(`      - ${func}`));
    
    console.log('\n   🗑️  Consider removing these potentially redundant functions:');
    potentiallyUnused.forEach(func => console.log(`      - ${func}`));
    
    console.log('\n   🔧 For the duplicate is_break_window_ending_soon:');
    if (duplicateCheck.rows.length === 2 && duplicateCheck.rows[0].prosrc === duplicateCheck.rows[1].prosrc) {
      console.log('      ✅ Both functions are identical - keep both (PostgreSQL overloading)');
    } else if (duplicateCheck.rows.length === 2) {
      console.log('      🚨 Functions have different source code - remove the older one');
      console.log('      💡 Keep the one with timestamp without time zone (more common usage)');
    }

    // 5. Check which functions are actually being called in the system
    console.log('\n5️⃣ Function Usage in Codebase:');
    try {
      const usageCheck = await pool.query(`
        SELECT 
          proname,
          COUNT(*) as call_count
        FROM pg_stat_statements 
        WHERE query LIKE '%break%'
        GROUP BY proname
        ORDER BY call_count DESC
      `);

      if (usageCheck.rows.length > 0) {
        console.log('   📊 Function call frequency (if pg_stat_statements is available):');
        usageCheck.rows.forEach(row => {
          console.log(`      ${row.proname}: ${row.call_count} calls`);
        });
      } else {
        console.log('   ℹ️  pg_stat_statements not available - cannot check actual usage');
      }
    } catch (error) {
      console.log('   ℹ️  pg_stat_statements not available - cannot check actual usage');
    }

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupDuplicateFunctionsAnalysis();
