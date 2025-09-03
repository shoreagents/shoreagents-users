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

async function checkBreakTriggers() {
  console.log('🔍 Checking all triggers on break_sessions table...\n');

  try {
    // Check all triggers on break_sessions table
    const triggers = await executeQuery(`
      SELECT 
        trigger_name, 
        event_manipulation, 
        action_timing, 
        action_statement,
        action_orientation
      FROM information_schema.triggers 
      WHERE event_object_table = 'break_sessions'
      ORDER BY trigger_name
    `);
    
    console.log('📋 Triggers found on break_sessions table:');
    if (triggers.length === 0) {
      console.log('❌ No triggers found!');
    } else {
      triggers.forEach((trigger, index) => {
        console.log(`${index + 1}. ${trigger.trigger_name}`);
        console.log(`   Event: ${trigger.event_manipulation}`);
        console.log(`   Timing: ${trigger.action_timing}`);
        console.log(`   Statement: ${trigger.action_statement}`);
        console.log('');
      });
    }
    
    // Check if the function exists
    console.log('🔍 Checking if calculate_break_duration function exists...');
    const functions = await executeQuery(`
      SELECT 
        routine_name, 
        routine_type, 
        data_type,
        routine_definition
      FROM information_schema.routines 
      WHERE routine_name = 'calculate_break_duration'
      AND routine_type = 'FUNCTION'
    `);
    
    if (functions.length === 0) {
      console.log('❌ calculate_break_duration function does not exist!');
    } else {
      console.log('✅ calculate_break_duration function exists');
      console.log('Function definition:', functions[0].routine_definition);
    }
    
  } catch (error) {
    console.error('❌ Error checking triggers:', error);
  }
}

// Run the check
checkBreakTriggers().then(() => {
  console.log('\n🏁 Check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
