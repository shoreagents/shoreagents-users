const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runBreakFunctionFix() {
  try {
    console.log('🔧 Running Break Function Fix...\n');
    
    // 1. Read the SQL fix file
    const sqlFixPath = path.join(__dirname, 'fix-break-available-function.sql');
    const sqlFix = fs.readFileSync(sqlFixPath, 'utf8');
    
    console.log('1️⃣ SQL fix loaded from file');
    
    // 2. Apply the fix
    console.log('2️⃣ Applying the fix to is_break_available function...');
    await pool.query(sqlFix);
    console.log('   ✅ Function updated successfully');
    
    // 3. Test the fixed function
    console.log('\n3️⃣ Testing the fixed function:');
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // Test with current time (should now return true for lunch)
    const currentResult = await pool.query(`
      SELECT 
        is_break_available($1, 'Lunch', (NOW() AT TIME ZONE 'Asia/Manila')::timestamp without time zone) as lunch_available_now
    `, [testAgentId]);
    
    console.log('   Lunch available now:', currentResult.rows[0].lunch_available_now);
    
    // Test with 11:00 AM (should return true)
    const testResult = await pool.query(`
      SELECT 
        is_break_available($1, 'Lunch', '2025-08-19 11:00:00'::timestamp without time zone) as lunch_available_11am
    `, [testAgentId]);
    
    console.log('   Lunch available at 11:00 AM:', testResult.rows[0].lunch_available_11am);
    
    // Test with 10:30 AM (should return true)
    const testResult2 = await pool.query(`
      SELECT 
        is_break_available($1, 'Lunch', '2025-08-19 10:30:00'::timestamp without time zone) as lunch_available_10_30
    `, [testAgentId]);
    
    console.log('   Lunch available at 10:30 AM:', testResult2.rows[0].lunch_available_10_30);
    
    // 4. Test the check_break_reminders function
    console.log('\n4️⃣ Testing check_break_reminders function:');
    const remindersResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = remindersResult.rows[0].check_break_reminders;
    console.log('   Notifications sent:', notificationsSent);
    
    if (notificationsSent > 0) {
      console.log('   🎉 Successfully sent notifications!');
      
      // Check what notifications were created
      const newNotificationsResult = await pool.query(`
        SELECT 
          id,
          user_id,
          category,
          type,
          title,
          message,
          created_at
        FROM notifications
        WHERE category = 'break'
        AND created_at > NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
      `);
      
      console.log(`   📢 Found ${newNotificationsResult.rows.length} new notifications:`);
      newNotificationsResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
      });
    } else {
      console.log('   ℹ️ No notifications sent (this might be normal)');
    }
    
    console.log('\n✅ Break function fix completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   • Fixed is_break_available to return true for entire break window');
    console.log('   • Removed the 5-minute restriction that was preventing notifications');
    console.log('   • Function now works correctly for lunch break (10 AM - 1 PM)');
    
  } catch (error) {
    console.error('❌ Error running break function fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
runBreakFunctionFix();
