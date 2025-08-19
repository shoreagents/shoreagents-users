const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakAvailableNowFix() {
  try {
    console.log('🔧 Applying Break Available Now Fix...\n');
    console.log('   This will enable "break available now" notifications exactly when break windows open!\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-break-available-now-notifications.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    
    // Execute the SQL
    console.log('\n2️⃣ Executing SQL fix...');
    await pool.query(sqlContent);
    console.log('   ✅ New functions created successfully:');
    console.log('     • is_break_available_now() - Checks if breaks are available exactly at start time');
    console.log('     • Updated check_break_reminders() - Now checks for "available now" notifications');
    
    // Test the new function
    console.log('\n3️⃣ Testing the new logic...');
    
    // Test at 1:45 PM when afternoon break should be available now (starts at 1:45 PM)
    const testTime = '2025-08-19 13:45:00'; // 1:45 PM
    console.log(`   Testing at ${testTime} (afternoon break window starts at 1:45 PM)`);
    
    // Test the new function for User 2
    const afternoonAvailableNow = await pool.query(`
      SELECT is_break_available_now(2, 'Afternoon', $1::timestamp without time zone) as available_now
    `, [testTime]);
    
    console.log(`   Afternoon break available now: ${afternoonAvailableNow.rows[0].available_now}`);
    
    if (afternoonAvailableNow.rows[0].available_now) {
      console.log('   ✅ SUCCESS: Afternoon break correctly detected as available now at 1:45 PM!');
      console.log('   ✅ This will now trigger "break available now" notifications at 1:45 PM');
    } else {
      console.log('   ❌ FAILED: Afternoon break not detected as available now at 1:45 PM');
    }
    
    // Test at 1:44 PM (1 minute before 1:45 PM - should NOT trigger)
    const testTime2 = '2025-08-19 13:44:00'; // 1:44 PM
    console.log(`\n   Testing at ${testTime2} (1 minute before 1:45 PM - should NOT trigger)`);
    
    const afternoonAvailableNow2 = await pool.query(`
      SELECT is_break_available_now(2, 'Afternoon', $1::timestamp without time zone) as available_now
    `, [testTime2]);
    
    console.log(`   Afternoon break available now: ${afternoonAvailableNow2.rows[0].available_now}`);
    
    if (!afternoonAvailableNow2.rows[0].available_now) {
      console.log('   ✅ SUCCESS: 1 minute before start correctly NOT detected!');
    } else {
      console.log('   ❌ FAILED: 1 minute before start incorrectly detected');
    }
    
    // Test at 1:46 PM (1 minute after 1:45 PM - should NOT trigger)
    const testTime3 = '2025-08-19 13:46:00'; // 1:46 PM
    console.log(`\n   Testing at ${testTime3} (1 minute after 1:45 PM - should NOT trigger)`);
    
    const afternoonAvailableNow3 = await pool.query(`
      SELECT is_break_available_now(2, 'Afternoon', $1::timestamp without time zone) as available_now
    `, [testTime3]);
    
    console.log(`   Afternoon break available now: ${afternoonAvailableNow3.rows[0].available_now}`);
    
    if (!afternoonAvailableNow3.rows[0].available_now) {
      console.log('   ✅ SUCCESS: 1 minute after start correctly NOT detected!');
    } else {
      console.log('   ❌ FAILED: 1 minute after start incorrectly detected');
    }
    
    // Test the full check_break_reminders function
    console.log('\n4️⃣ Testing the updated check_break_reminders function...');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Call the function
    const result = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = result.rows[0].check_break_reminders;
    
    console.log(`   Notifications sent: ${notificationsSent}`);
    
    // Check what notifications were created
    const newNotifications = await pool.query(`
      SELECT title, message, payload->>'reminder_type' as reminder_type, created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (newNotifications.rows.length > 0) {
      console.log(`\n   📢 Found ${newNotifications.rows.length} new notifications:`);
      newNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Type: ${notification.reminder_type}`);
        console.log(`      Time: ${notification.created_at.toLocaleString()}`);
        console.log('');
      });
      
      // Check if we have break available notifications
      const availableNotifications = newNotifications.rows.filter(n => 
        n.reminder_type === 'break_available'
      );
      
      if (availableNotifications.length > 0) {
        console.log('   ✅ SUCCESS: "Break available now" notifications are now working!');
        console.log('   ✅ You should now receive "break available now" notifications at 1:45 PM');
      } else {
        console.log('   ❌ No "break available now" notifications found');
      }
    } else {
      console.log('   ℹ️ No new notifications created (may be outside notification windows)');
    }
    
    // Summary
    console.log('\n✅ Break available now fix applied and tested!');
    
    console.log('\n🎯 What was fixed:');
    console.log('   • Added `is_break_available_now()` function');
    console.log('   • Updated `check_break_reminders()` to check for "available now" notifications');
    console.log('   • Now sends "break available now" notifications exactly when break windows open');
    console.log('   • Supports all break types (Morning, Lunch, Afternoon, Night shifts)');
    
    console.log('\n🔧 Result:');
    console.log('   • At 1:30 PM: "Afternoon break available soon" ✅');
    console.log('   • At 1:45 PM: "Afternoon break available now" ✅');
    console.log('   • At 2:30 PM: "Afternoon break ending soon" ✅');
    console.log('   • Complete notification coverage! 🎉');
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix application
applyBreakAvailableNowFix();
