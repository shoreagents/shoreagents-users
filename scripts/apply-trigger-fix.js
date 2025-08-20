const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyTriggerFix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying Health Check Trigger Fix...\n');
    
    // 1. Read and apply the trigger fix
    console.log('1️⃣ Reading trigger fix SQL...');
    const fs = require('fs');
    const sqlFix = fs.readFileSync('./scripts/fix-health-check-trigger.sql', 'utf8');
    console.log('   ✅ SQL fix loaded');
    
    console.log('\n2️⃣ Applying trigger fix...');
    await client.query(sqlFix);
    console.log('   ✅ Trigger function fixed and recreated');
    
    // 2. Test the fixed trigger
    console.log('\n3️⃣ Testing the fixed trigger...');
    
    // Create a test request
    const testResult = await client.query(
      `INSERT INTO health_check_requests (user_id, complaint, symptoms, priority, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [2, 'Test complaint for trigger testing', 'Test symptoms', 'normal']
    );
    
    const newRequest = testResult.rows[0];
    console.log('   ✅ Test request created successfully:');
    console.log(`     ID: ${newRequest.id}, User: ${newRequest.user_id}`);
    console.log(`     Status: ${newRequest.status}, Priority: ${newRequest.priority}`);
    
    // Check if notifications were created
    const notificationCheck = await client.query(
      `SELECT * FROM notifications 
       WHERE category = 'health_check' 
       AND payload->>'request_id' = $1`,
      [newRequest.id.toString()]
    );
    
    console.log(`   ✅ Created ${notificationCheck.rows.length} notifications:`);
    notificationCheck.rows.forEach((notif, index) => {
      console.log(`     ${index + 1}. User ${notif.user_id}: ${notif.title}`);
    });
    
    // Test status update trigger
    console.log('\n4️⃣ Testing status update trigger...');
    
    await client.query(
      `UPDATE health_check_requests 
       SET status = 'approved', approved_time = NOW()
       WHERE id = $1`,
      [newRequest.id]
    );
    
    // Check for approval notification
    const approvalNotifications = await client.query(
      `SELECT * FROM notifications 
       WHERE category = 'health_check' 
       AND payload->>'request_id' = $1
       AND payload->>'event_type' = 'request_approved'`,
      [newRequest.id.toString()]
    );
    
    console.log(`   ✅ Created ${approvalNotifications.rows.length} approval notifications`);
    
    // Clean up test data
    console.log('\n5️⃣ Cleaning up test data...');
    await client.query('DELETE FROM notifications WHERE payload->>>\'request_id\' = $1', [newRequest.id.toString()]);
    await client.query('DELETE FROM health_check_requests WHERE id = $1', [newRequest.id]);
    console.log('   ✅ Test data cleaned up');
    
    console.log('\n🎉 Health Check Trigger Fix Applied Successfully!');
    
  } catch (error) {
    console.error('\n❌ Error applying trigger fix:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the fix
applyTriggerFix();
