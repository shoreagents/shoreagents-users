const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFunction() {
  try {
    console.log('🧪 Testing get_activity_date_for_shift_simple function...');
    
    // Test with user 4
    const result = await pool.query('SELECT get_activity_date_for_shift_simple(4) as activity_date');
    console.log('📅 Activity date for user 4:', result.rows[0].activity_date);
    
    // Check user 4's shift info
    const shiftInfo = await pool.query(`
      SELECT ji.shift_time, ji.shift_period, ji.shift_schedule 
      FROM job_info ji 
      WHERE ji.agent_user_id = 4 
      LIMIT 1
    `);
    console.log('👤 User 4 shift info:', shiftInfo.rows[0]);
    
    // Check current Manila time
    const currentTime = await pool.query(`
      SELECT 
        CURRENT_TIMESTAMP + INTERVAL '8 hours' as manila_time,
        (CURRENT_TIMESTAMP + INTERVAL '8 hours')::TIME as manila_time_only,
        (CURRENT_TIMESTAMP + INTERVAL '8 hours')::DATE as manila_date
    `);
    console.log('🕐 Current Manila time:', currentTime.rows[0]);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testFunction();
