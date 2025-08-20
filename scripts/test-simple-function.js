const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testSimpleFunction() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing simple function to isolate the issue...\n');
    
    // Create a super simple test function
    console.log('1️⃣ Creating test function...');
    await client.query(`
      DROP FUNCTION IF EXISTS test_simple_function() CASCADE;
      
      CREATE FUNCTION test_simple_function()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          agent_record RECORD;
          agent_id INTEGER;
          result_count INTEGER := 0;
      BEGIN
          FOR agent_record IN
              SELECT DISTINCT u.id as user_id
              FROM users u
              INNER JOIN agents a ON u.id = a.user_id
              WHERE u.user_type = 'Agent'
          LOOP
              agent_id := agent_record.user_id::INTEGER;
              
              -- Try to call calculate_break_windows
              PERFORM calculate_break_windows(agent_id);
              result_count := result_count + 1;
          END LOOP;
          
          RETURN result_count;
      END;
      $$;
    `);
    console.log('   ✅ Test function created');
    
    // Test the simple function
    console.log('\n2️⃣ Testing simple function...');
    try {
      const result = await client.query('SELECT test_simple_function()');
      console.log(`   ✅ Success: Processed ${result.rows[0].test_simple_function} agents`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    // Clean up
    await client.query('DROP FUNCTION IF EXISTS test_simple_function() CASCADE');
    
  } catch (error) {
    console.error('\n❌ Error in test:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testSimpleFunction();
