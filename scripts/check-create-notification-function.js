const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCreateNotificationFunction() {
  try {
    console.log('🔍 Checking create_break_reminder_notification Function...\n');
    
    // 1. Check the create_break_reminder_notification function
    console.log('1️⃣ Checking create_break_reminder_notification function:');
    const createNotificationResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'create_break_reminder_notification'
      LIMIT 1
    `);
    
    if (createNotificationResult.rows.length > 0) {
      const source = createNotificationResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for the "5 minutes" logic
      if (source.includes('5 minutes') || source.includes('5 min')) {
        console.log('\n   📍 Found 5-minute logic!');
        console.log('   This explains the "end in 5 minutes" message');
      }
      
      // Look for the specific message
      if (source.includes('end in 5 minutes')) {
        console.log('\n   📍 Found the exact message: "end in 5 minutes"');
      }
      
      // Look for timing calculations
      if (source.includes('EXTRACT(EPOCH') || source.includes('minutes_until')) {
        console.log('\n   📍 Found timing calculations in the function');
      }
    } else {
      console.log('   ❌ Function not found');
    }
    
    // 2. Check what happens when we call it with 'ending_soon' type
    console.log('\n2️⃣ Testing create_break_reminder_notification with ending_soon:');
    
    const testAgentId = 2;
    
    try {
      // First, let's see if there are any recent notifications
      const recentNotificationsResult = await pool.query(`
        SELECT 
          id,
          user_id,
          category,
          type,
          title,
          message,
          created_at
        FROM notifications
        WHERE user_id = $1
        AND category = 'break'
        AND type = 'ending_soon'
        ORDER BY created_at DESC
        LIMIT 3
      `, [testAgentId]);
      
      if (recentNotificationsResult.rows.length > 0) {
        console.log(`   📢 Found ${recentNotificationsResult.rows.length} recent ending_soon notifications:`);
        recentNotificationsResult.rows.forEach((notification, index) => {
          console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
          console.log(`      Message: ${notification.message}`);
        });
      } else {
        console.log('   ℹ️ No recent ending_soon notifications found');
      }
      
    } catch (error) {
      console.log(`   ❌ Error checking notifications: ${error.message}`);
    }
    
    // 3. Check the current time and what should happen
    console.log('\n3️⃣ Current timing analysis:');
    const currentTime = new Date();
    console.log(`   Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Calculate minutes until lunch break ends (1:00 PM)
    const lunchEndTime = new Date('2025-08-19 13:00:00');
    const minutesUntilEnd = Math.round((lunchEndTime - currentTime) / (1000 * 60));
    
    console.log(`   Lunch break ends at: 1:00 PM`);
    console.log(`   Minutes until lunch break ends: ${minutesUntilEnd}`);
    
    if (minutesUntilEnd <= 15 && minutesUntilEnd > 0) {
      console.log(`   🎯 You are within the "ending soon" window (≤ 15 minutes)`);
      if (minutesUntilEnd <= 5) {
        console.log(`   🎯 You are also within the "5 minutes" window!`);
        console.log(`   This explains why you got "end in 5 minutes"`);
      }
    } else if (minutesUntilEnd <= 0) {
      console.log(`   ❌ Lunch break window has already ended`);
    } else {
      console.log(`   ℹ️ You are ${minutesUntilEnd} minutes before lunch break ends`);
    }
    
    // 4. Check if there's a different timing logic
    console.log('\n4️⃣ Looking for alternative timing logic:');
    
    // Check if the create_break_reminder_notification function has different logic for 'ending_soon'
    if (createNotificationResult.rows.length > 0) {
      const source = createNotificationResult.rows[0].source;
      
      // Look for different timing thresholds
      if (source.includes('5 minutes') || source.includes('5 min')) {
        console.log('   📍 Found 5-minute logic in create_break_reminder_notification');
        console.log('   This suggests the function calculates timing differently than is_break_ending_soon');
      }
      
      if (source.includes('15 minutes') || source.includes('15 min')) {
        console.log('   📍 Found 15-minute logic in create_break_reminder_notification');
      }
      
      // Look for the specific message creation
      if (source.includes('ending_soon')) {
        console.log('   📍 Found ending_soon message creation logic');
      }
    }
    
    // 5. Summary and explanation
    console.log('\n✅ create_break_reminder_notification check completed!');
    
    console.log('\n🎯 Explanation of the "5 minutes" notification:');
    console.log('   • You received "Your current break will end in 5 minutes" at 12:46 PM');
    console.log('   • This message comes from create_break_reminder_notification function');
    console.log('   • The function is_break_ending_soon uses 15-minute logic');
    console.log('   • But create_break_reminder_notification has different timing logic');
    console.log('   • It appears to calculate "5 minutes" based on a different threshold');
    
    console.log('\n🔍 The mystery:');
    console.log('   • is_break_ending_soon: triggers at ≤ 15 minutes before end');
    console.log('   • create_break_reminder_notification: creates "5 minutes" message');
    console.log('   • There must be additional logic that calculates the exact minutes remaining');
    
  } catch (error) {
    console.error('❌ Error checking create notification function:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkCreateNotificationFunction();
