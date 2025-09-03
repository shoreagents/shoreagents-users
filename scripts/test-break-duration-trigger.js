const { Pool } = require('pg');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function executeQuery(query, params = []) {
  const pool = new Pool(databaseConfig);
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
    await pool.end();
  }
}

async function testBreakDurationTrigger() {
  console.log('🧪 Testing break duration calculation trigger...\n');

  try {
    // First, check if the trigger exists
    console.log('1. Checking if trigger exists...');
    const triggerCheck = await executeQuery(`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'break_sessions' 
      AND trigger_name = 'calculate_break_duration_trigger'
    `);
    
    if (triggerCheck.length === 0) {
      console.log('❌ Trigger does not exist!');
      return;
    }
    
    console.log('✅ Trigger exists:', triggerCheck[0]);
    
    // Check if the function exists
    console.log('\n2. Checking if function exists...');
    const functionCheck = await executeQuery(`
      SELECT routine_name, routine_type, data_type
      FROM information_schema.routines 
      WHERE routine_name = 'calculate_break_duration'
      AND routine_type = 'FUNCTION'
    `);
    
    if (functionCheck.length === 0) {
      console.log('❌ Function does not exist!');
      return;
    }
    
    console.log('✅ Function exists:', functionCheck[0]);
    
    // Test the trigger with a sample break session
    console.log('\n3. Testing trigger with sample data...');
    
    // Create a test break session
    const testAgentId = 2; // Using the agent from your example
    const testBreakType = 'Morning';
    
    // Insert a test break session
    const insertResult = await executeQuery(`
      INSERT INTO break_sessions (agent_user_id, break_type, start_time, break_date)
      VALUES ($1, $2::break_type_enum, NOW() - INTERVAL '2 minutes', (NOW() AT TIME ZONE 'Asia/Manila')::date)
      RETURNING id, start_time, end_time, duration_minutes
    `, [testAgentId, testBreakType]);
    
    const breakId = insertResult[0].id;
    console.log('✅ Test break session created:', insertResult[0]);
    
    // Update the break session to set end_time (this should trigger the duration calculation)
    const updateResult = await executeQuery(`
      UPDATE break_sessions 
      SET end_time = NOW()
      WHERE id = $1
      RETURNING id, start_time, end_time, duration_minutes
    `, [breakId]);
    
    console.log('✅ Break session updated:', updateResult[0]);
    
    if (updateResult[0].duration_minutes === null) {
      console.log('❌ Duration was not calculated! The trigger is not working.');
    } else {
      console.log('✅ Duration calculated successfully:', updateResult[0].duration_minutes, 'minutes');
    }
    
    // Clean up test data
    await executeQuery('DELETE FROM break_sessions WHERE id = $1', [breakId]);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Error testing trigger:', error);
  }
}

// Run the test
testBreakDurationTrigger().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
