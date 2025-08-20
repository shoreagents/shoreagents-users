const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

function getPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
}

async function testRecordsAPI() {
  try {
    console.log('🔍 Testing Health Check Records API...\n');

    const pool = getPool();
    
    try {
      // Test the count query first
      console.log('1️⃣ Testing count query...');
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM health_check_records WHERE user_id = $1',
        [1]
      );
      console.log(`   Found ${countResult.rows[0].total} records for user_id=1`);
      
      // Test the main query
      console.log('\n2️⃣ Testing main records query...');
      const result = await pool.query(
        `SELECT hcr.*, 
               u.email as user_email,
               n.email as nurse_email
        FROM health_check_records hcr
        LEFT JOIN users u ON hcr.user_id = u.id
        LEFT JOIN users n ON hcr.nurse_id = n.id
        WHERE hcr.user_id = $1
        ORDER BY hcr.visit_date DESC, hcr.visit_time DESC
        LIMIT $2 OFFSET $3`,
        [1, 50, 0]
      );
      
      console.log(`   Found ${result.rows.length} records:`);
      result.rows.forEach((record, index) => {
        console.log(`     ${index + 1}. Date: ${record.visit_date}, Time: ${record.visit_time}`);
        console.log(`        Complaint: ${record.chief_complaint}`);
        console.log(`        User: ${record.user_email}, Nurse: ${record.nurse_email}`);
      });
      
      // Test API response format
      console.log('\n3️⃣ API Response Format:');
      const total = parseInt(countResult.rows[0].total);
      const limit = 50;
      const offset = 0;
      
      const response = { 
        success: true, 
        records: result.rows,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
      
      console.log('   Response structure:');
      console.log(`     - success: ${response.success}`);
      console.log(`     - records: ${response.records.length} items`);
      console.log(`     - pagination.total: ${response.pagination.total}`);
      console.log(`     - pagination.hasMore: ${response.pagination.hasMore}`);
      
      // Test with different user IDs
      console.log('\n4️⃣ Testing with different user IDs...');
      for (let userId of [1, 2, 4]) {
        const userCount = await pool.query(
          'SELECT COUNT(*) as total FROM health_check_records WHERE user_id = $1',
          [userId]
        );
        console.log(`     User ${userId}: ${userCount.rows[0].total} records`);
      }
      
    } finally {
      await pool.end();
    }
    
  } catch (e) {
    console.error('❌ Error testing records API:', e.message);
    console.error('Stack trace:', e.stack);
  }
}

// Run the test
testRecordsAPI();
