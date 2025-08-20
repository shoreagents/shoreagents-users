const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debug5MinuteNotification() {
  try {
    console.log('🔍 Debugging "5 Minutes" Notification...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // 1. Check what notification was actually created
    console.log('1️⃣ Checking the actual notification that was created:');
    const notificationResult = await pool.query(`
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
      AND created_at > '2025-08-19 12:45:00'::timestamp
      AND created_at < '2025-08-19 12:47:00'::timestamp
      ORDER BY created_at DESC
      LIMIT 5
    `, [testAgentId]);
    
    if (notificationResult.rows.length > 0) {
      console.log(`   📢 Found ${notificationResult.rows.length} notification(s):`);
      notificationResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. [${notification.created_at.toLocaleString()}] ${notification.title}`);
        console.log(`      Type: ${notification.type}, Message: ${notification.message}`);
      });
      
      // Look for the specific message
      const fiveMinNotification = notificationResult.rows.find(n => 
        n.message.includes('5 minutes') || n.message.includes('end in 5 minutes')
      );
      
      if (fiveMinNotification) {
        console.log('\n   🎯 Found the "5 minutes" notification!');
        console.log(`   Title: ${fiveMinNotification.title}`);
        console.log(`   Message: ${fiveMinNotification.message}`);
        console.log(`   Type: ${fiveMinNotification.type}`);
        console.log(`   Created at: ${fiveMinNotification.created_at.toLocaleString()}`);
      }
    } else {
      console.log('   ❌ No notifications found in that time range');
    }
    
    // 2. Check what function created this notification
    console.log('\n2️⃣ Checking what function logic created this notification:');
    
    // Look at the check_break_reminders function to see if it has 5-minute logic
    const checkBreakRemindersResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
      LIMIT 1
    `);
    
    if (checkBreakRemindersResult.rows.length > 0) {
      const source = checkBreakRemindersResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for 5-minute logic
      if (source.includes('5 minutes') || source.includes('5 min')) {
        console.log('\n   📍 Found 5-minute logic in check_break_reminders!');
        console.log('   This explains why you got "5 minutes" instead of "15 minutes"');
      }
      
      // Look for the specific message
      if (source.includes('end in 5 minutes')) {
        console.log('\n   📍 Found the exact message: "end in 5 minutes"');
      }
    }
    
    // 3. Check if there are multiple functions with different timing
    console.log('\n3️⃣ Checking for multiple timing functions:');
    
    const timingFunctionsResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_identity_arguments(oid) as arguments
      FROM pg_proc 
      WHERE proname LIKE '%ending%' OR proname LIKE '%end%' OR proname LIKE '%reminder%'
      ORDER BY proname
    `);
    
    console.log('   Functions that might handle timing:');
    timingFunctionsResult.rows.forEach((func, index) => {
      console.log(`   ${index + 1}. ${func.function_name}(${func.arguments})`);
    });
    
    // 4. Test the current time to see what should happen
    console.log('\n4️⃣ Testing current timing logic:');
    const currentTime = new Date();
    console.log(`   Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Test is_break_ending_soon at current time
    try {
      const endingSoonResult = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [testAgentId, currentTime]);
      
      console.log(`   is_break_ending_soon result: ${endingSoonResult.rows[0].ending_soon}`);
    } catch (error) {
      console.log(`   is_break_ending_soon error: ${error.message}`);
    }
    
    // 5. Check if there's a different function being called
    console.log('\n5️⃣ Looking for alternative timing logic:');
    
    // Search for any function that mentions "5 minutes"
    const fiveMinFunctionsResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_identity_arguments(oid) as arguments
      FROM pg_proc 
      WHERE pg_get_functiondef(oid) LIKE '%5 minutes%' OR pg_get_functiondef(oid) LIKE '%5 min%'
    `);
    
    if (fiveMinFunctionsResult.rows.length > 0) {
      console.log('   Functions that mention "5 minutes":');
      fiveMinFunctionsResult.rows.forEach((func, index) => {
        console.log(`   ${index + 1}. ${func.function_name}(${func.arguments})`);
      });
    } else {
      console.log('   No functions found that mention "5 minutes"');
    }
    
    // 6. Summary and explanation
    console.log('\n✅ 5-minute notification debug completed!');
    
    console.log('\n🎯 Explanation of what happened:');
    console.log('   • You received "Your current break will end in 5 minutes" at 12:46 PM');
    console.log('   • This suggests there\'s a DIFFERENT function than is_break_ending_soon');
    console.log('   • The function is_break_ending_soon uses 15-minute logic');
    console.log('   • But another function is using 5-minute logic');
    console.log('   • This explains the discrepancy between expected and actual behavior');
    
    console.log('\n🔍 Next steps to investigate:');
    console.log('   • Check the check_break_reminders function for 5-minute logic');
    console.log('   • Look for other functions that might handle "ending soon"');
    console.log('   • The notification message suggests a different timing calculation');
    
  } catch (error) {
    console.error('❌ Error debugging 5-minute notification:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug
debug5MinuteNotification();
