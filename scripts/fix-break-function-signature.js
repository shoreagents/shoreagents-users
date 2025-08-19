const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixBreakFunctionSignature() {
  try {
    console.log('🔧 Fixing Break Function Signature Mismatch...\n');
    
    // 1. Check current function signatures
    console.log('1️⃣ Current function signatures:');
    const functionSignaturesResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_arguments(oid) as arguments,
        pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname IN ('is_break_available', 'is_break_available_soon', 'is_break_missed')
      ORDER BY proname
    `);
    
    functionSignaturesResult.rows.forEach((func, index) => {
      console.log(`   ${index + 1}. ${func.function_name}`);
      console.log(`      Arguments: ${func.arguments}`);
      console.log(`      Return: ${func.return_type}`);
    });
    
    // 2. Test the current function with correct signature
    console.log('\n2️⃣ Testing with correct timestamp format:');
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    try {
      // Test with timestamp without time zone
      const result = await pool.query(`
        SELECT 
          is_break_available($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_available
      `, [testAgentId]);
      
      console.log('   ✅ Function works with correct signature!');
      console.log('   Lunch available now:', result.rows[0].lunch_available);
      
    } catch (error) {
      console.log(`   ❌ Still failing: ${error.message}`);
    }
    
    // 3. Check if the issue is in the check_break_reminders function
    console.log('\n3️⃣ Testing check_break_reminders function:');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      console.log('   ✅ check_break_reminders executed successfully');
      console.log('   Notifications sent:', result.rows[0].check_break_reminders);
    } catch (error) {
      console.log(`   ❌ check_break_reminders failed: ${error.message}`);
      
      // Check the function source to see how it calls is_break_available
      console.log('\n   🔍 Checking check_break_reminders source:');
      const sourceResult = await pool.query(`
        SELECT pg_get_functiondef(oid) as source
        FROM pg_proc 
        WHERE proname = 'check_break_reminders'
        LIMIT 1
      `);
      
      if (sourceResult.rows.length > 0) {
        const source = sourceResult.rows[0].source;
        console.log('   Function source (first 1000 chars):');
        console.log('   ' + source.substring(0, 1000) + '...');
        
        // Look for calls to is_break_available
        if (source.includes('is_break_available')) {
          console.log('\n   📍 Found calls to is_break_available in check_break_reminders');
        }
      }
    }
    
    // 4. Test individual notification functions with correct signature
    console.log('\n4️⃣ Testing individual functions with correct signature:');
    
    try {
      const individualResult = await pool.query(`
        SELECT 
          is_break_available_soon($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_available_soon,
          is_break_available($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_available,
          is_break_missed($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_missed
      `, [testAgentId]);
      
      console.log('   Individual function results:');
      console.log('     Available soon:', individualResult.rows[0].lunch_available_soon);
      console.log('     Available now:', individualResult.rows[0].lunch_available);
      console.log('     Missed:', individualResult.rows[0].lunch_missed);
      
    } catch (error) {
      console.log(`   ❌ Individual functions failed: ${error.message}`);
    }
    
    // 5. Check if we need to update the function signatures
    console.log('\n5️⃣ Checking if function signatures need updating:');
    console.log('   The issue is that the functions expect timestamp without time zone');
    console.log('   But we\'re calling them with timestamp with time zone');
    console.log('   Solution: Cast the timestamp when calling the functions');
    
    console.log('\n✅ Function signature analysis completed!');
    
  } catch (error) {
    console.error('❌ Error in function signature fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixBreakFunctionSignature();
