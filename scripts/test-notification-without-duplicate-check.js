const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testNotificationWithoutDuplicateCheck() {
  try {
    console.log('🧪 Testing Notification Without Duplicate Check...\n');
    
    // First, let's see what notifications exist
    console.log('1️⃣ Checking existing notifications:');
    const existingNotifications = await pool.query(`
      SELECT 
        id,
        title,
        message,
        created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND type = 'warning'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (existingNotifications.rows.length > 0) {
      console.log(`   Found ${existingNotifications.rows.length} existing notifications:`);
      existingNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}: ${notification.message}`);
        console.log(`      Created: ${notification.created_at.toLocaleString()}`);
      });
    } else {
      console.log('   No existing notifications found');
    }
    
    // Clear ALL recent notifications for User 2
    console.log('\n2️⃣ Clearing recent notifications for User 2:');
    const deleteResult = await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(`   Deleted ${deleteResult.rowCount} notifications`);
    
    // Now test creating a notification
    console.log('\n3️⃣ Testing notification creation after clearing:');
    
    const testResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'ending_soon')
    `);
    
    console.log('     ✅ Function executed successfully');
    
    // Check the created notification
    const newNotifications = await pool.query(`
      SELECT 
        title,
        message,
        created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND type = 'warning'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (newNotifications.rows.length > 0) {
      const notification = newNotifications.rows[0];
      console.log('\n   📢 New notification created:');
      console.log(`     Title: ${notification.title}`);
      console.log(`     Message: ${notification.message}`);
      console.log(`     Time: ${notification.created_at.toLocaleString()}`);
      
      // Analyze the message
      if (notification.message.includes('Lunch')) {
        console.log('     ✅ Message shows correct break type: Lunch');
      } else if (notification.message.includes('Morning')) {
        console.log('     ✅ Message shows correct break type: Morning');
      } else if (notification.message.includes('Afternoon')) {
        console.log('     ✅ Message shows correct break type: Afternoon');
      } else {
        console.log('     ❌ Message shows generic break type');
      }
      
      if (notification.message.includes('15 minutes')) {
        console.log('     ✅ Message shows correct timing: 15 minutes');
      } else if (notification.message.includes('14 minutes')) {
        console.log('     ✅ Message shows correct timing: 14 minutes');
      } else if (notification.message.includes('13 minutes')) {
        console.log('     ✅ Message shows correct timing: 13 minutes');
      } else if (notification.message.includes('will end soon')) {
        console.log('     ✅ Message shows generic "will end soon"');
      } else {
        console.log('     ❌ Message shows unexpected timing');
      }
      
      // Check if it's the old hardcoded message
      if (notification.message.includes('5 minutes')) {
        console.log('     ❌ Still has old hardcoded "5 minutes" message');
      } else {
        console.log('     ✅ No more hardcoded "5 minutes" message');
      }
      
    } else {
      console.log('     ❌ Still no notification created');
      
      // Let's check if there's an error in the function
      console.log('\n4️⃣ Checking for function errors:');
      try {
        const errorTest = await pool.query(`
          SELECT create_break_reminder_notification(2, 'ending_soon')
        `);
        console.log('     Function executed without error');
      } catch (error) {
        console.log(`     ❌ Function error: ${error.message}`);
      }
    }
    
    // Summary
    console.log('\n✅ Notification test completed!');
    
  } catch (error) {
    console.error('❌ Error testing notification:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testNotificationWithoutDuplicateCheck();
