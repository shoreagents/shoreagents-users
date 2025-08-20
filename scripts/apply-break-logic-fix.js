const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakLogicFix() {
  try {
    console.log('🔧 Applying Break Logic Fix...\n');
    
    // 1. Read and apply the SQL fix
    const sqlFixPath = path.join(__dirname, 'fix-break-available-logic.sql');
    const sqlFix = fs.readFileSync(sqlFixPath, 'utf8');
    
    console.log('1️⃣ Applying the fix to is_break_available function...');
    await pool.query(sqlFix);
    console.log('   ✅ Function updated successfully');
    
    // 2. Test the fixed function
    console.log('\n2️⃣ Testing the fixed function:');
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // Test at different times to verify the fix
    const testTimes = [
      '2025-08-19 09:45:00', // 9:45 AM - should NOT be available
      '2025-08-19 10:00:00', // 10:00 AM - should be available (start time)
      '2025-08-19 10:30:00', // 10:30 AM - should NOT be available (should be missed)
      '2025-08-19 11:00:00', // 11:00 AM - should NOT be available (should be missed)
      '2025-08-19 12:30:00', // 12:30 PM - should NOT be available (should be missed)
      '2025-08-19 12:35:00', // 12:35 PM - should NOT be available (should be missed)
      '2025-08-19 13:00:00', // 1:00 PM - should NOT be available (window ends)
    ];
    
    console.log('   Testing is_break_available at different times:');
    for (const testTime of testTimes) {
      try {
        const result = await pool.query(`
          SELECT 
            is_break_available($1, 'Lunch', $2::timestamp without time zone) as lunch_available
        `, [testAgentId, testTime]);
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        const isAvailable = result.rows[0].lunch_available;
        const expectedBehavior = timeLabel === '10:00:00' ? '✅ Should be available' : '❌ Should NOT be available';
        const status = isAvailable ? '✅ AVAILABLE' : '❌ Not available';
        
        console.log(`   ${timeLabel}: ${status} - ${expectedBehavior}`);
        
        // Verify the fix worked
        if (timeLabel === '10:00:00' && !isAvailable) {
          console.log(`   🚨 ERROR: 10:00 AM should be available but isn't!`);
        } else if (timeLabel !== '10:00:00' && isAvailable) {
          console.log(`   🚨 ERROR: ${timeLabel} should NOT be available but is!`);
        }
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 3. Test the check_break_reminders function with the fix
    console.log('\n3️⃣ Testing check_break_reminders with fixed logic:');
    try {
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      console.log(`   ✅ Function executed successfully - Notifications sent: ${notificationsSent}`);
      
      if (notificationsSent > 0) {
        console.log('   🎉 Successfully sent notifications with fixed logic!');
        
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
          console.log(`      Type: ${notification.type}, Message: ${notification.message}`);
        });
      } else {
        console.log('   ℹ️ No notifications sent (this might be normal with current time)');
      }
      
    } catch (error) {
      console.log(`   ❌ Function failed: ${error.message}`);
    }
    
    // 4. Summary of the fix
    console.log('\n✅ Break logic fix completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   • Fixed is_break_available to only return true at exact start time');
    console.log('   • Removed the flawed logic that treated entire break window as "available"');
    console.log('   • Now lunch break only shows as "available" at 10:00 AM exactly');
    console.log('   • After 10:00 AM, lunch break will show as "missed" every 30 minutes');
    console.log('   • This matches the expected frontend behavior');
    
    console.log('\n🎯 Expected behavior now:');
    console.log('   • 9:45 AM: "Break available soon" (15 min before)');
    console.log('   • 10:00 AM: "Break available now" (exact start time)');
    console.log('   • 10:30 AM: "You have not taken your lunch break yet!" (missed)');
    console.log('   • 11:00 AM: "You have not taken your lunch break yet!" (missed)');
    console.log('   • 11:30 AM: "You have not taken your lunch break yet!" (missed)');
    console.log('   • 12:00 PM: "You have not taken your lunch break yet!" (missed)');
    console.log('   • 12:30 PM: "You have not taken your lunch break yet!" (missed)');
    console.log('   • 12:55 PM: "Break ending soon" (5 min before end)');
    console.log('   • 1:00 PM: Lunch break window closes');
    
  } catch (error) {
    console.error('❌ Error applying break logic fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
applyBreakLogicFix();
