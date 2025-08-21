const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getFunctionSource() {
  try {
    console.log('🔍 Getting is_break_missed function source code...\n');
    
    const result = await pool.query(`
      SELECT pg_get_functiondef(oid) as function_source
      FROM pg_proc 
      WHERE proname = 'is_break_missed'
      LIMIT 1;
    `);
    
    if (result.rows.length > 0) {
      console.log('📋 Function source code:');
      console.log('=' .repeat(80));
      console.log(result.rows[0].function_source);
      console.log('=' .repeat(80));
    } else {
      console.log('❌ Function not found');
    }
    
  } catch (error) {
    console.error('❌ Error getting function source:', error.message);
  } finally {
    await pool.end();
  }
}

getFunctionSource();
