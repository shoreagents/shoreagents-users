const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkFunctionSource() {
  try {
    console.log('🔍 Checking Function Source Code...\n');
    
    // 1. Check is_break_available function source
    console.log('1️⃣ is_break_available function source:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_available'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
    } else {
      console.log('   ❌ Function not found');
    }
    
    // 2. Check break_sessions table structure
    console.log('\n2️⃣ break_sessions table structure:');
    const tableStructureResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'break_sessions'
      ORDER BY ordinal_position
    `);
    
    console.log('   Table columns:');
    tableStructureResult.rows.forEach((column, index) => {
      console.log(`   ${index + 1}. ${column.column_name} (${column.data_type}, nullable: ${column.is_nullable})`);
    });
    
    // 3. Check if there are any break sessions for today
    console.log('\n3️⃣ Break sessions for today:');
    const todayBreaksResult = await pool.query(`
      SELECT 
        id,
        agent_user_id,
        break_type,
        created_at,
        break_date
      FROM break_sessions 
      WHERE DATE(created_at) = (NOW() AT TIME ZONE 'Asia/Manila')::DATE
      ORDER BY created_at
    `);
    
    if (todayBreaksResult.rows.length > 0) {
      console.log(`   Found ${todayBreaksResult.rows.length} break sessions today:`);
      todayBreaksResult.rows.forEach((breakSession, index) => {
        console.log(`   ${index + 1}. ${breakSession.break_type} break for agent ${breakSession.agent_user_id} at ${breakSession.created_at}`);
      });
    } else {
      console.log('   No break sessions found for today');
    }
    
    // 4. Test the function with a simple case
    console.log('\n4️⃣ Testing function with simple case:');
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    try {
      // Test with a time that should definitely work (11:00 AM)
      const testResult = await pool.query(`
        SELECT 
          is_break_available($1, 'Lunch', '2025-08-19 11:00:00'::timestamp without time zone) as lunch_available_11am
      `, [testAgentId]);
      
      console.log('   Lunch available at 11:00 AM:', testResult.rows[0].lunch_available_11am);
      
      // Test with current time
      const currentResult = await pool.query(`
        SELECT 
          is_break_available($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_available_now
      `, [testAgentId]);
      
      console.log('   Lunch available now:', currentResult.rows[0].lunch_available_now);
      
    } catch (error) {
      console.log(`   ❌ Function test failed: ${error.message}`);
    }
    
    console.log('\n✅ Function source check completed!');
    
  } catch (error) {
    console.error('❌ Error in function source check:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkFunctionSource();
