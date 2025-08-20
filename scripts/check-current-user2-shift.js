const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentUser2Shift() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking current User 2 shift and break windows...\n');
    
    // Check current shift time
    console.log('1️⃣ Current User 2 job_info:');
    const jobInfo = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 2
    `);
    
    if (jobInfo.rows.length > 0) {
      const job = jobInfo.rows[0];
      console.log(`   User ID: ${job.agent_user_id}`);
      console.log(`   Employee ID: ${job.employee_id}`);
      console.log(`   Job Title: ${job.job_title}`);
      console.log(`   Shift Time: ${job.shift_time}`);
      console.log(`   Shift Period: ${job.shift_period}`);
      console.log(`   Last Updated: ${job.updated_at}`);
    }
    
    // Check get_agent_shift_info
    console.log('\n2️⃣ get_agent_shift_info result:');
    const shiftInfo = await client.query(`
      SELECT * FROM get_agent_shift_info(2)
    `);
    
    if (shiftInfo.rows.length > 0) {
      const info = shiftInfo.rows[0];
      console.log(`   User ID: ${info.user_id}`);
      console.log(`   Shift Time: ${info.shift_time}`);
      console.log(`   Shift Period: ${info.shift_period}`);
      console.log(`   Shift Schedule: ${info.shift_schedule}`);
    }
    
    // Calculate break windows
    console.log('\n3️⃣ Current break windows:');
    const windows = await client.query(`
      SELECT * FROM calculate_break_windows($1)
    `, [jobInfo.rows[0].shift_time]);
    
    if (windows.rows.length > 0) {
      const w = windows.rows[0];
      console.log(`   Morning Break: ${w.morning_start} - ${w.morning_end}`);
      console.log(`   Lunch Break: ${w.lunch_start} - ${w.lunch_end}`);
      console.log(`   Afternoon Break: ${w.afternoon_start} - ${w.afternoon_end}`);
    }
    
    // Test notification functions at current time
    console.log('\n4️⃣ Testing notification functions at current time:');
    const currentTime = new Date().toISOString();
    console.log(`   Current time: ${currentTime}`);
    
    const morningAvailableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    const lunchAvailableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    const afternoonAvailableSoon = await client.query(`
      SELECT is_break_available_soon(2, 'Afternoon'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    console.log(`   Morning available soon: ${morningAvailableSoon.rows[0].result}`);
    console.log(`   Lunch available soon: ${lunchAvailableSoon.rows[0].result}`);
    console.log(`   Afternoon available soon: ${afternoonAvailableSoon.rows[0].result}`);
    
    const morningAvailableNow = await client.query(`
      SELECT is_break_available_now(2, 'Morning'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    const lunchAvailableNow = await client.query(`
      SELECT is_break_available_now(2, 'Lunch'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    const afternoonAvailableNow = await client.query(`
      SELECT is_break_available_now(2, 'Afternoon'::break_type_enum, $1::timestamp) as result
    `, [currentTime]);
    
    console.log(`   Morning available now: ${morningAvailableNow.rows[0].result}`);
    console.log(`   Lunch available now: ${lunchAvailableNow.rows[0].result}`);
    console.log(`   Afternoon available now: ${afternoonAvailableNow.rows[0].result}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

checkCurrentUser2Shift();
