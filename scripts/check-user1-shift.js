const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUser1Shift() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking User 1 shift configuration...\n');
    
    // Check job_info table
    console.log('1️⃣ Checking job_info table:');
    const jobInfoResult = await client.query(`
      SELECT * FROM job_info WHERE agent_user_id = 1
    `);
    
    if (jobInfoResult.rows.length > 0) {
      console.log('   ✅ Found job_info record:');
      console.log('      Agent User ID:', jobInfoResult.rows[0].agent_user_id);
      console.log('      Shift Time:', jobInfoResult.rows[0].shift_time);
      console.log('      Shift Period:', jobInfoResult.rows[0].shift_period);
      console.log('      Job Title:', jobInfoResult.rows[0].job_title);
    } else {
      console.log('   ❌ No job_info record found for User 1');
    }
    
    // Check users table
    console.log('\n2️⃣ Checking users table:');
    const usersResult = await client.query(`
      SELECT * FROM users WHERE id = 1
    `);
    
    if (usersResult.rows.length > 0) {
      console.log('   ✅ Found user record:');
      console.log('      ID:', usersResult.rows[0].id);
      console.log('      Email:', usersResult.rows[0].email);
      console.log('      User Type:', usersResult.rows[0].user_type);
    }
    
    // Check agents table
    console.log('\n3️⃣ Checking agents table:');
    const agentsResult = await client.query(`
      SELECT * FROM agents WHERE user_id = 1
    `);
    
    if (agentsResult.rows.length > 0) {
      console.log('   ✅ Found agent record:');
      console.log('      User ID:', agentsResult.rows[0].user_id);
      console.log('      Member ID:', agentsResult.rows[0].member_id);
    } else {
      console.log('   ❌ No agent record found for User 1');
    }
    
    // Test get_agent_shift_info function directly
    console.log('\n4️⃣ Testing get_agent_shift_info function:');
    const shiftInfoResult = await client.query(`
      SELECT * FROM get_agent_shift_info(1)
    `);
    
    if (shiftInfoResult.rows.length > 0) {
      console.log('   ✅ Function result:');
      console.log('      User ID:', shiftInfoResult.rows[0].user_id);
      console.log('      Shift Time:', shiftInfoResult.rows[0].shift_time);
      console.log('      Shift Period:', shiftInfoResult.rows[0].shift_period);
      console.log('      Shift Schedule:', shiftInfoResult.rows[0].shift_schedule);
    } else {
      console.log('   ❌ Function returned no results');
    }
    
    // Check if there's a mismatch between agent_user_id and internal_user_id
    console.log('\n5️⃣ Checking for internal_user_id mismatch:');
    const internalResult = await client.query(`
      SELECT * FROM job_info WHERE internal_user_id = 1
    `);
    
    if (internalResult.rows.length > 0) {
      console.log('   ⚠️  Found job_info record with internal_user_id = 1:');
      console.log('      Internal User ID:', internalResult.rows[0].internal_user_id);
      console.log('      Agent User ID:', internalResult.rows[0].agent_user_id);
      console.log('      Shift Time:', internalResult.rows[0].shift_time);
    } else {
      console.log('   ✅ No internal_user_id = 1 found');
    }
    
  } catch (error) {
    console.error('❌ Error checking User 1 shift:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await checkUser1Shift();
  } catch (error) {
    console.error('❌ Failed to check User 1 shift:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkUser1Shift };
