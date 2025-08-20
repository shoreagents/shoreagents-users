const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAvailableFunctions() {
  try {
    console.log('🔍 Available Break Functions:\n');
    
    const result = await pool.query(`
      SELECT proname as function_name 
      FROM pg_proc 
      WHERE proname LIKE '%break%' 
      ORDER BY proname
    `);
    
    result.rows.forEach(row => {
      console.log(`   ${row.function_name}`);
    });
    
    console.log('\n📋 Functions that should exist for afternoon break notifications:');
    console.log('   ✅ is_break_available_soon - for 2:30 PM (15 min before start)');
    console.log('   ✅ is_break_available_now - for 2:45 PM (at start)');
    console.log('   ✅ is_break_reminder_due - for 3:15 PM (30 min after start)');
    console.log('   ✅ is_break_window_ending_soon - for 3:30 PM (15 min before end)');
    
  } catch (error) {
    console.error('❌ Error checking available functions:', error.message);
  } finally {
    await pool.end();
  }
}

checkAvailableFunctions();
