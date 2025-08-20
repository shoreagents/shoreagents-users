const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

async function testMainHealthAPI() {
  try {
    console.log('🔍 Testing Main Health Check API...\n');

    const pool = getPool();
    
    try {
      // Test GET endpoint query
      console.log('1️⃣ Testing GET requests query...');
      
      let query = `
        SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email
        FROM health_check_requests hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        WHERE hcr.user_id = $1
        ORDER BY hcr.request_time DESC LIMIT $2
      `;
      
      const result = await pool.query(query, [1, 50]);
      
      console.log(`   Found ${result.rows.length} health check requests for user_id=1:`);
      result.rows.forEach((request, index) => {
        console.log(`     ${index + 1}. Status: ${request.status}, Priority: ${request.priority}`);
        console.log(`        Complaint: ${request.complaint}`);
        console.log(`        User: ${request.user_email}, Nurse: ${request.nurse_email || 'Not assigned'}`);
        console.log(`        Request Time: ${request.request_time}`);
      });
      
      // Test with status filter
      console.log('\n2️⃣ Testing with status filter...');
      
      const statusQuery = `
        SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email
        FROM health_check_requests hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        WHERE hcr.user_id = $1 AND hcr.status = $2
        ORDER BY hcr.request_time DESC LIMIT $3
      `;
      
      const statusResult = await pool.query(statusQuery, [1, 'pending', 50]);
      console.log(`   Found ${statusResult.rows.length} pending requests for user_id=1`);
      
      // Test POST endpoint - create a test request
      console.log('\n3️⃣ Testing POST request creation...');
      
      const insertResult = await pool.query(
        `INSERT INTO health_check_requests (user_id, complaint, symptoms, priority, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [2, 'Test complaint for API testing', 'Test symptoms', 'normal']
      );
      
      const newRequest = insertResult.rows[0];
      console.log('   ✅ Created test request:');
      console.log(`     ID: ${newRequest.id}, User: ${newRequest.user_id}`);
      console.log(`     Complaint: ${newRequest.complaint}`);
      console.log(`     Status: ${newRequest.status}, Priority: ${newRequest.priority}`);
      
      // Test API response format
      console.log('\n4️⃣ API Response Format:');
      
      const response = { 
        success: true, 
        requests: result.rows 
      };
      
      console.log('   GET Response structure:');
      console.log(`     - success: ${response.success}`);
      console.log(`     - requests: ${response.requests.length} items`);
      
      const postResponse = { 
        success: true, 
        request: newRequest 
      };
      
      console.log('   POST Response structure:');
      console.log(`     - success: ${postResponse.success}`);
      console.log(`     - request: object with id ${postResponse.request.id}`);
      
      // Clean up test data
      console.log('\n5️⃣ Cleaning up test data...');
      await pool.query('DELETE FROM health_check_requests WHERE id = $1', [newRequest.id]);
      console.log('   ✅ Test request deleted');
      
    } finally {
      await pool.end();
    }
    
  } catch (e) {
    console.error('❌ Error testing main health API:', e.message);
    console.error('Stack trace:', e.stack);
  }
}

// Run the test
testMainHealthAPI();
