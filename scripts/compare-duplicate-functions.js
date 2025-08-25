const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function compareDuplicateFunctions() {
  console.log('🔍 Comparing Duplicate Functions\n');
  
  try {
    // Get the duplicate functions
    const result = await pool.query(`
      SELECT 
        proname,
        proargtypes::regtype[] as arg_types,
        oid,
        prosrc,
        proargnames as arg_names
      FROM pg_proc 
      WHERE proname = 'is_break_window_ending_soon'
      ORDER BY oid
    `);

    if (result.rows.length === 2) {
      const func1 = result.rows[0];
      const func2 = result.rows[1];
      
      console.log('📋 Function 1:');
      console.log(`   OID: ${func1.oid}`);
      const argTypes1 = Array.isArray(func1.arg_types) ? func1.arg_types.join(', ') : func1.arg_types.toString();
      console.log(`   Arguments: ${argTypes1}`);
      const argNames1 = Array.isArray(func1.arg_names) ? func1.arg_names.join(', ') : (func1.arg_names || 'N/A');
      console.log(`   Argument Names: ${argNames1}`);
      console.log(`   Source Code:`);
      console.log('   ' + '='.repeat(80));
      console.log(func1.prosrc);
      console.log('   ' + '='.repeat(80));
      
      console.log('\n📋 Function 2:');
      console.log(`   OID: ${func2.oid}`);
      const argTypes2 = Array.isArray(func2.arg_types) ? func2.arg_types.join(', ') : func2.arg_types.toString();
      console.log(`   Arguments: ${argTypes2}`);
      const argNames2 = Array.isArray(func2.arg_names) ? func2.arg_names.join(', ') : (func2.arg_names || 'N/A');
      console.log(`   Argument Names: ${argNames2}`);
      console.log(`   Source Code:`);
      console.log('   ' + '='.repeat(80));
      console.log(func2.prosrc);
      console.log('   ' + '='.repeat(80));
      
      // Check if they're functionally identical
      if (func1.prosrc === func2.prosrc) {
        console.log('\n✅ Functions have identical source code - only parameter types differ');
        console.log('   This suggests PostgreSQL function overloading, which is normal');
      } else {
        console.log('\n❌ Functions have different source code - this is a problem!');
        
        // Find the first difference
        const minLength = Math.min(func1.prosrc.length, func2.prosrc.length);
        let firstDiff = -1;
        for (let i = 0; i < minLength; i++) {
          if (func1.prosrc[i] !== func2.prosrc[i]) {
            firstDiff = i;
            break;
          }
        }
        
        if (firstDiff !== -1) {
          console.log(`\n📍 First difference at character ${firstDiff}:`);
          console.log(`   Function 1: "${func1.prosrc.substring(firstDiff, firstDiff + 50)}"`);
          console.log(`   Function 2: "${func2.prosrc.substring(firstDiff, firstDiff + 50)}"`);
        }
      }
    } else {
      console.log(`❌ Expected 2 functions, found ${result.rows.length}`);
    }

  } catch (error) {
    console.error('❌ Error comparing functions:', error.message);
  } finally {
    await pool.end();
  }
}

compareDuplicateFunctions();
