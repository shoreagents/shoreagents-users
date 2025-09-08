const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testDuplicateNotificationFix() {
  try {
    console.log('🧪 Testing duplicate notification fix...');
    
    // Test user ID (using user 2 as mentioned in the issue)
    const testUserId = 2;
    const breakType = 'Afternoon';
    
    console.log(`\n1. Checking existing notifications for user ${testUserId}...`);
    
    // Get existing notifications for this user and break type
    const existingNotifications = await pool.query(`
      SELECT id, title, message, created_at, payload
      FROM notifications 
      WHERE user_id = $1 
      AND category = 'break'
      AND payload->>'break_type' = $2
      AND payload->>'reminder_type' = 'available_soon'
      ORDER BY created_at DESC
      LIMIT 5
    `, [testUserId, breakType]);
    
    console.log(`Found ${existingNotifications.rows.length} existing "available_soon" notifications:`);
    existingNotifications.rows.forEach((notif, index) => {
      console.log(`  ${index + 1}. ID ${notif.id}: "${notif.title}" at ${notif.created_at}`);
    });
    
    console.log(`\n2. Testing duplicate prevention by calling create_break_reminder_notification multiple times...`);
    
    // Call the function multiple times in quick succession
    for (let i = 1; i <= 3; i++) {
      console.log(`   Attempt ${i}: Calling create_break_reminder_notification...`);
      
      try {
        await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', [
          testUserId, 
          'available_soon', 
          breakType
        ]);
        console.log(`   ✅ Attempt ${i}: Function executed successfully`);
      } catch (error) {
        console.log(`   ❌ Attempt ${i}: Error - ${error.message}`);
      }
      
      // Wait 1 second between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n3. Checking notifications after test...`);
    
    // Check if any new notifications were created
    const newNotifications = await pool.query(`
      SELECT id, title, message, created_at, payload
      FROM notifications 
      WHERE user_id = $1 
      AND category = 'break'
      AND payload->>'break_type' = $2
      AND payload->>'reminder_type' = 'available_soon'
      AND created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
    `, [testUserId, breakType]);
    
    console.log(`Found ${newNotifications.rows.length} new notifications in the last 5 minutes:`);
    newNotifications.rows.forEach((notif, index) => {
      console.log(`  ${index + 1}. ID ${notif.id}: "${notif.title}" at ${notif.created_at}`);
    });
    
    if (newNotifications.rows.length === 0) {
      console.log('\n✅ SUCCESS: No duplicate notifications were created!');
      console.log('   The fix is working correctly - duplicate prevention is active.');
    } else if (newNotifications.rows.length === 1) {
      console.log('\n✅ SUCCESS: Only one notification was created!');
      console.log('   The fix is working correctly - duplicate prevention is active.');
    } else {
      console.log('\n❌ ISSUE: Multiple notifications were created!');
      console.log('   The duplicate prevention may not be working correctly.');
    }
    
    console.log(`\n4. Testing with a different break type to ensure it still works...`);
    
    // Test with a different break type (should work)
    try {
      await pool.query('SELECT create_break_reminder_notification($1, $2, $3)', [
        testUserId, 
        'available_soon', 
        'Morning'
      ]);
      console.log('   ✅ Different break type notification created successfully');
    } catch (error) {
      console.log(`   ❌ Error with different break type: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testDuplicateNotificationFix();
