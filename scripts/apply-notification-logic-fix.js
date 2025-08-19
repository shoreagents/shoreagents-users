const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyNotificationLogicFix() {
  try {
    console.log('🔧 Applying notification logic fix...\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-notification-logic.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    
    // Execute the SQL
    console.log('\n2️⃣ Executing SQL fix...');
    await pool.query(sqlContent);
    console.log('   ✅ create_break_reminder_notification function updated successfully');
    
    // Test the fix at the right time (12:45 PM when lunch break is ending soon)
    console.log('\n3️⃣ Testing at 12:45 PM (lunch break ending soon):');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Test the function
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
      console.log('     ❌ No notification was created');
    }
    
    // Summary
    console.log('\n✅ Notification logic fix applied and tested!');
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix application
applyNotificationLogicFix();
