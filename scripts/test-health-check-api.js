const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testHealthCheckAPI() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing Health Check API...\n');
    
    // 1. Test the query that the API is running
    console.log('1️⃣ Testing availability query...');
    
    const query = `
      SELECT hca.*, 
             u.email as nurse_email,
             u.user_type as nurse_role
      FROM health_check_availability hca
      LEFT JOIN users u ON hca.nurse_id = u.id
      WHERE u.user_type = 'Internal'
      ORDER BY hca.nurse_id, hca.day_of_week
    `;
    
    const result = await client.query(query);
    
    console.log(`   Found ${result.rows.length} availability records:`);
    result.rows.forEach((row, index) => {
      console.log(`     ${index + 1}. Nurse: ${row.nurse_email || 'Unknown'} (ID: ${row.nurse_id})`);
      console.log(`        Day: ${row.day_of_week}, Shift: ${row.shift_start} - ${row.shift_end}`);
      console.log(`        Available: ${row.is_available}, Break: ${row.break_start} - ${row.break_end}`);
    });
    
    // 2. Check if users table has Internal role users
    console.log('\n2️⃣ Checking Internal users...');
    
    const usersResult = await client.query(`
      SELECT id, email, user_type 
      FROM users 
      WHERE user_type = 'Internal'
    `);
    
    console.log(`   Found ${usersResult.rows.length} Internal users:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`     ${index + 1}. ${user.email} (ID: ${user.id}) - Type: ${user.user_type}`);
    });
    
    // 3. Check if there's any availability data at all
    console.log('\n3️⃣ Checking all availability data...');
    
    const allAvailability = await client.query(`
      SELECT * FROM health_check_availability ORDER BY nurse_id, day_of_week
    `);
    
    console.log(`   Total availability records: ${allAvailability.rows.length}`);
    allAvailability.rows.forEach((row, index) => {
      console.log(`     ${index + 1}. Nurse ID: ${row.nurse_id}, Day: ${row.day_of_week}, Available: ${row.is_available}`);
    });
    
    // 4. Check if the JOIN is working
    console.log('\n4️⃣ Testing JOIN without role filter...');
    
    const joinTest = await client.query(`
      SELECT hca.nurse_id, hca.day_of_week, hca.is_available,
             u.id as user_id, u.email, u.user_type
      FROM health_check_availability hca
      LEFT JOIN users u ON hca.nurse_id = u.id
      ORDER BY hca.nurse_id, hca.day_of_week
    `);
    
    console.log(`   JOIN results: ${joinTest.rows.length} records`);
    joinTest.rows.forEach((row, index) => {
      console.log(`     ${index + 1}. Nurse ID: ${row.nurse_id}, User: ${row.email || 'NULL'}, Type: ${row.user_type || 'NULL'}`);
    });
    
    // 5. Check user roles in general
    console.log('\n5️⃣ Checking all user roles...');
    
    const allUsers = await client.query(`
      SELECT id, email, user_type FROM users ORDER BY id
    `);
    
    console.log(`   All users:`);
    allUsers.rows.forEach((user, index) => {
      console.log(`     ${index + 1}. ID: ${user.id}, Email: ${user.email}, Type: ${user.user_type}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error testing health check API:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the test
testHealthCheckAPI();
