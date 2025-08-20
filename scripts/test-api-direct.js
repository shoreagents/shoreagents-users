const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

async function testAPILogic() {
  try {
    console.log('🔍 Testing Health Check API Logic...\n');

    const pool = getPool();
    
    try {
      // This is the exact query from the API
      let query = `
        SELECT hca.*, 
               u.email as nurse_email,
               u.user_type as nurse_role
        FROM health_check_availability hca
        LEFT JOIN users u ON hca.nurse_id = u.id
        WHERE u.user_type = 'Internal'
        ORDER BY hca.nurse_id, hca.day_of_week
      `;
      
      const result = await pool.query(query);
      
      console.log('✅ API Query Result:');
      console.log(`   Found ${result.rows.length} records`);
      
      const response = { 
        success: true, 
        availability: result.rows 
      };
      
      console.log('\n📋 API Response:');
      console.log(JSON.stringify(response, null, 2));
      
      // Test with specific parameters
      console.log('\n🔍 Testing with nurse_id parameter...');
      
      const paramQuery = `
        SELECT hca.*, 
               u.email as nurse_email,
               u.user_type as nurse_role
        FROM health_check_availability hca
        LEFT JOIN users u ON hca.nurse_id = u.id
        WHERE u.user_type = 'Internal' AND hca.nurse_id = $1
        ORDER BY hca.nurse_id, hca.day_of_week
      `;
      
      const paramResult = await pool.query(paramQuery, [1]);
      console.log(`   Found ${paramResult.rows.length} records for nurse_id=1`);
      
    } finally {
      await pool.end();
    }
    
  } catch (e) {
    console.error('❌ Error testing API logic:', e.message);
    console.error('Stack trace:', e.stack);
  }
}

// Run the test
testAPILogic();
