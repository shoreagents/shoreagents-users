const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkHealthCheckData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking Health Check Data Status...\n');
    
    // 1. Check health_check_requests table
    console.log('1️⃣ Health Check Requests:');
    const requests = await client.query(`
      SELECT hcr.*, 
             u.email as user_email,
             n.email as nurse_email
      FROM health_check_requests hcr
      LEFT JOIN users u ON hcr.user_id = u.id
      LEFT JOIN users n ON hcr.nurse_id = n.id
      ORDER BY hcr.created_at DESC
    `);
    
    if (requests.rows.length > 0) {
      console.log(`   Found ${requests.rows.length} requests:`);
      requests.rows.forEach((request, index) => {
        console.log(`     ${index + 1}. ID: ${request.id}, User: ${request.user_email}`);
        console.log(`        Complaint: ${request.complaint}`);
        console.log(`        Status: ${request.status}, Priority: ${request.priority}`);
        console.log(`        Created: ${request.created_at}`);
      });
    } else {
      console.log('   ❌ No health check requests found');
    }
    
    // 2. Check health_check_records table (actual visits)
    console.log('\n2️⃣ Health Check Records (Actual Visits):');
    const records = await client.query(`
      SELECT hcr.*, 
             u.email as user_email,
             n.email as nurse_email
      FROM health_check_records hcr
      LEFT JOIN users u ON hcr.user_id = u.id
      LEFT JOIN users n ON hcr.nurse_id = n.id
      ORDER BY hcr.visit_date DESC, hcr.visit_time DESC
    `);
    
    if (records.rows.length > 0) {
      console.log(`   Found ${records.rows.length} records:`);
      records.rows.forEach((record, index) => {
        console.log(`     ${index + 1}. Date: ${record.visit_date}, Time: ${record.visit_time}`);
        console.log(`        User: ${record.user_email}, Nurse: ${record.nurse_email}`);
        console.log(`        Complaint: ${record.chief_complaint}`);
        console.log(`        Diagnosis: ${record.diagnosis || 'Not specified'}`);
      });
    } else {
      console.log('   ❌ No health check records found');
    }
    
    // 3. Check notifications
    console.log('\n3️⃣ Health Check Notifications:');
    const notifications = await client.query(`
      SELECT * FROM notifications 
      WHERE category = 'health_check'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (notifications.rows.length > 0) {
      console.log(`   Found ${notifications.rows.length} notifications:`);
      notifications.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. User ${notif.user_id}: ${notif.title}`);
        console.log(`        Type: ${notif.type}, Created: ${notif.created_at}`);
      });
    } else {
      console.log('   ❌ No health check notifications found');
    }
    
    // 4. Check current user context
    console.log('\n4️⃣ Current User Context:');
    console.log('   The frontend is likely looking for data for a specific user_id');
    console.log('   You need to check what user_id the frontend is requesting');
    console.log('   Common user IDs in your system:');
    
    const users = await client.query(`
      SELECT id, email, user_type FROM users ORDER BY id
    `);
    
    users.rows.forEach((user, index) => {
      console.log(`     ${index + 1}. ID: ${user.id}, Email: ${user.email}, Type: ${user.user_type}`);
    });
    
    // 5. Test API endpoints for different users
    console.log('\n5️⃣ Testing API for different users:');
    for (const user of users.rows) {
      const userRequests = await client.query(
        'SELECT COUNT(*) as count FROM health_check_requests WHERE user_id = $1',
        [user.id]
      );
      const userRecords = await client.query(
        'SELECT COUNT(*) as count FROM health_check_records WHERE user_id = $1',
        [user.id]
      );
      
      console.log(`   User ${user.id} (${user.email}):`);
      console.log(`     - Requests: ${userRequests.rows[0].count}`);
      console.log(`     - Records: ${userRecords.rows[0].count}`);
    }
    
    console.log('\n📋 Summary:');
    console.log('   • Health check requests: User-submitted requests for health checks');
    console.log('   • Health check records: Actual clinic visits and treatments');
    console.log('   • The frontend shows "No Recent Health Checks" because:');
    console.log('     1. No requests exist for the current user, OR');
    console.log('     2. The API is not returning data correctly, OR');
    console.log('     3. The frontend is not calling the API with the right user_id');
    
  } catch (error) {
    console.error('\n❌ Error checking health check data:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkHealthCheckData();
