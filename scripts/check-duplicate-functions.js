const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkDuplicateFunctions() {
  console.log('🔍 Checking for Duplicate Functions\n');
  
  try {
    // Check all break-related functions
    const functions = [
      'is_break_available',
      'is_break_available_now',
      'is_break_available_now_notification_sent',
      'is_break_available_soon',
      'is_break_ending_soon',
      'is_break_missed',
      'is_break_reminder_due',
      'is_break_window_ending_soon'
    ];

    for (const funcName of functions) {
      console.log(`\n📋 Checking ${funcName}:`);
      
      const result = await pool.query(`
        SELECT 
          proname,
          proargtypes::regtype[] as arg_types,
          oid,
          prosrc
        FROM pg_proc 
        WHERE proname = $1 
        ORDER BY oid
      `, [funcName]);

      if (result.rows.length === 0) {
        console.log(`   ❌ Function ${funcName} not found`);
      } else if (result.rows.length === 1) {
        const argTypes = Array.isArray(result.rows[0].arg_types) 
          ? result.rows[0].arg_types.join(', ') 
          : result.rows[0].arg_types.toString();
        console.log(`   ✅ Found 1 function: ${argTypes}`);
      } else {
        console.log(`   ⚠️  Found ${result.rows.length} duplicate functions:`);
        result.rows.forEach((row, index) => {
          const argTypes = Array.isArray(row.arg_types) 
            ? row.arg_types.join(', ') 
            : row.arg_types.toString();
          console.log(`      ${index + 1}. ${argTypes} (OID: ${row.oid})`);
        });
        
        // Show source code differences for duplicates
        if (result.rows.length > 1) {
          console.log(`   📝 Source code comparison:`);
          const firstSrc = result.rows[0].prosrc;
          const secondSrc = result.rows[1].prosrc;
          
          if (firstSrc === secondSrc) {
            console.log(`      ✅ All duplicates have identical source code`);
          } else {
            console.log(`      ❌ Duplicates have different source code`);
            console.log(`      📄 First function source (first 200 chars):`);
            console.log(`         ${firstSrc.substring(0, 200)}...`);
            console.log(`      📄 Second function source (first 200 chars):`);
            console.log(`         ${secondSrc.substring(0, 200)}...`);
          }
        }
      }
    }

    // Check for any other potential duplicates
    console.log('\n🔍 Checking for other potential duplicates...');
    const allBreakFunctions = await pool.query(`
      SELECT 
        proname,
        COUNT(*) as count,
        array_agg(proargtypes::regtype[] ORDER BY oid) as all_signatures
      FROM pg_proc 
      WHERE proname LIKE '%break%'
      GROUP BY proname
      HAVING COUNT(*) > 1
      ORDER BY proname
    `);

    if (allBreakFunctions.rows.length > 0) {
      console.log('\n⚠️  Found functions with multiple signatures:');
      allBreakFunctions.rows.forEach(row => {
        console.log(`   ${row.proname}: ${row.count} signatures`);
        if (Array.isArray(row.all_signatures)) {
          row.all_signatures.forEach((sig, index) => {
            const argTypes = Array.isArray(sig) ? sig.join(', ') : sig.toString();
            console.log(`      ${index + 1}. ${argTypes}`);
          });
        }
      });
    } else {
      console.log('\n✅ No other break-related functions with duplicates found');
    }

  } catch (error) {
    console.error('❌ Error checking functions:', error.message);
  } finally {
    await pool.end();
  }
}

checkDuplicateFunctions();
