const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkFunctionSignatures() {
  try {
    console.log('📋 Break Function Signatures:\n');
    
    const result = await pool.query(`
      SELECT 
        proname as function_name, 
        pg_get_function_identity_arguments(oid) as args 
      FROM pg_proc 
      WHERE proname IN ('is_break_reminder_due', 'is_break_available_soon', 'is_break_available_now', 'is_break_window_ending_soon')
      ORDER BY proname
    `);
    
    result.rows.forEach(row => {
      console.log(`${row.function_name}(${row.args})`);
    });
    
    console.log('\n🔍 Testing function calls with correct signatures:');
    
    // Test the 2-parameter version of is_break_reminder_due
    console.log('\n🕐 Testing is_break_reminder_due with 2 parameters:');
    try {
      const reminderResult = await pool.query(`
        SELECT is_break_reminder_due($1, 'Morning') as reminder_due
      `, [2]);
      
      console.log(`   Current time reminder due (Morning): ${reminderResult.rows[0].reminder_due ? '✅ TRUE' : '❌ FALSE'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    try {
      const reminderResult = await pool.query(`
        SELECT is_break_reminder_due($1, 'Lunch') as reminder_due
      `, [2]);
      
      console.log(`   Current time reminder due (Lunch): ${reminderResult.rows[0].reminder_due ? '✅ TRUE' : '❌ FALSE'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    try {
      const reminderResult = await pool.query(`
        SELECT is_break_reminder_due($1, 'Afternoon') as reminder_due
      `, [2]);
      
      console.log(`   Current time reminder due (Afternoon): ${reminderResult.rows[0].reminder_due ? '✅ TRUE' : '❌ FALSE'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking function signatures:', error.message);
  } finally {
    await pool.end();
  }
}

checkFunctionSignatures();