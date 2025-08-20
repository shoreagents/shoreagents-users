const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugStepByStep() {
  const client = await pool.connect();
  try {
    console.log('🔍 Debugging step by step...\n');
    
    // Step 1: Check what agents exist
    console.log('1️⃣ Checking agents...');
    const agents = await client.query(`
      SELECT DISTINCT u.id, u.user_type
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      WHERE u.user_type = 'Agent'
    `);
    
    console.log(`   Found ${agents.rows.length} agents:`);
    agents.rows.forEach((agent, index) => {
      console.log(`     ${index + 1}. ID: ${agent.id} (${typeof agent.id}), Type: ${agent.user_type}`);
    });
    
    // Step 2: Test calculate_break_windows with the first agent
    if (agents.rows.length > 0) {
      const firstAgentId = agents.rows[0].id;
      console.log(`\n2️⃣ Testing calculate_break_windows(${firstAgentId})...`);
      
      try {
        const breakWindows = await client.query(`SELECT * FROM calculate_break_windows(${firstAgentId})`);
        console.log(`   ✅ Success: Found ${breakWindows.rows.length} break windows`);
        if (breakWindows.rows.length > 0) {
          breakWindows.rows.forEach((window, index) => {
            console.log(`     ${index + 1}. ${window.break_type}: ${window.start_time} - ${window.end_time}`);
          });
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Step 3: Test the exact query from check_break_reminders
    console.log('\n3️⃣ Testing the exact query from check_break_reminders...');
    try {
      const testQuery = await client.query(`
        SELECT DISTINCT u.id as user_id
        FROM users u
        INNER JOIN agents a ON u.id = a.user_id
        WHERE u.user_type = 'Agent'
        LIMIT 1
      `);
      
      if (testQuery.rows.length > 0) {
        const testUserId = testQuery.rows[0].user_id;
        console.log(`   ✅ Query successful: user_id = ${testUserId} (${typeof testUserId})`);
        
        // Now test calculate_break_windows with this value
        console.log(`   🔍 Testing calculate_break_windows(${testUserId})...`);
        try {
          const testBreakWindows = await client.query(`SELECT * FROM calculate_break_windows(${testUserId})`);
          console.log(`   ✅ calculate_break_windows successful: ${testBreakWindows.rows.length} windows`);
        } catch (error) {
          console.log(`   ❌ calculate_break_windows failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Query failed: ${error.message}`);
    }
    
    // Step 4: Check the function source again
    console.log('\n4️⃣ Checking check_break_reminders function source...');
    try {
      const functionSource = await client.query(`
        SELECT prosrc FROM pg_proc WHERE proname = 'check_break_reminders'
      `);
      
      if (functionSource.rows.length > 0) {
        const source = functionSource.rows[0].prosrc;
        console.log('   Function source preview:');
        const lines = source.split('\n').slice(0, 25);
        lines.forEach((line, index) => {
          console.log(`      ${index + 1}: ${line}`);
        });
        if (source.split('\n').length > 25) {
          console.log('      ... (truncated)');
        }
      }
    } catch (error) {
      console.log(`   Error getting source: ${error.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error in debug:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the debug
debugStepByStep();
