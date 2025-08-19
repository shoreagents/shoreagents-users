#!/usr/bin/env node

/**
 * Test Database Function Directly
 * 
 * This script tests the check_break_availability() function directly
 * to see if it can create break notifications.
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testDatabaseFunction() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing Database Function Directly...\n');
    
    // Check current time
    const now = new Date();
    console.log(`Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Check if there are any break notifications before running the function
    const beforeQuery = `
      SELECT COUNT(*) as count
      FROM notifications 
      WHERE category = 'break'
      AND created_at >= CURRENT_DATE
    `;
    
    const beforeResult = await client.query(beforeQuery);
    console.log(`Break notifications before: ${beforeResult.rows[0].count}`);
    
    // Run the database function
    console.log('\n🔄 Running check_break_availability() function...');
    const functionResult = await client.query('SELECT check_break_availability()');
    console.log('✅ Function executed successfully');
    
    // Check if any notifications were created
    const afterQuery = `
      SELECT COUNT(*) as count
      FROM notifications 
      WHERE category = 'break'
      AND created_at >= CURRENT_DATE
    `;
    
    const afterResult = await client.query(afterQuery);
    console.log(`Break notifications after: ${afterResult.rows[0].count}`);
    
    // Show the new notifications
    if (afterResult.rows[0].count > beforeResult.rows[0].count) {
      const newNotificationsQuery = `
        SELECT id, type, title, message, created_at, payload
        FROM notifications 
        WHERE category = 'break'
        AND created_at >= CURRENT_DATE
        ORDER BY created_at DESC
        LIMIT 5
      `;
      
      const newNotifications = await client.query(newNotificationsQuery);
      console.log('\n📢 New break notifications created:');
      newNotifications.rows.forEach((notification, index) => {
        console.log(`\n${index + 1}. ${notification.title}`);
        console.log(`   Type: ${notification.type}`);
        console.log(`   Message: ${notification.message}`);
        console.log(`   Created: ${notification.created_at}`);
        if (notification.payload) {
          console.log(`   Payload: ${JSON.stringify(notification.payload, null, 2)}`);
        }
      });
    } else {
      console.log('\n❌ No new notifications were created');
      
      // Check why - maybe the function didn't find any users to process
      const usersQuery = `
        SELECT COUNT(*) as count
        FROM job_info ji
        WHERE ji.agent_user_id IS NOT NULL
        AND ji.shift_time IS NOT NULL
      `;
      
      const usersResult = await client.query(usersQuery);
      console.log(`Users with shift info: ${usersResult.rows[0].count}`);
      
      // Check if the function is actually checking the right time
      const timeCheckQuery = `
        SELECT NOW() AT TIME ZONE 'Asia/Manila' as philippines_time
      `;
      
      const timeResult = await client.query(timeCheckQuery);
      console.log(`Database Philippines time: ${timeResult.rows[0].philippines_time}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testDatabaseFunction().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testDatabaseFunction };
