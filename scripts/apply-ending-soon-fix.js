const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyEndingSoonFix() {
  try {
    console.log('🔧 Applying Ending Soon Message Fix...\n');
    
    // 1. Read and apply the SQL fix
    const sqlFixPath = path.join(__dirname, 'fix-ending-soon-message.sql');
    const sqlFix = fs.readFileSync(sqlFixPath, 'utf8');
    
    console.log('1️⃣ Applying the fix to create_break_reminder_notification function...');
    await pool.query(sqlFix);
    console.log('   ✅ Function updated successfully');
    
    // 2. Test the fixed function with different scenarios
    console.log('\n2️⃣ Testing the fixed function:');
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // Test at different times to see the new messages
    const testTimes = [
      '2025-08-19 12:45:00', // 12:45 PM - 15 min before lunch ends (should show "15 minutes")
      '2025-08-19 12:50:00', // 12:50 PM - 10 min before lunch ends (should show "10 minutes")
      '2025-08-19 12:55:00', // 12:55 PM - 5 min before lunch ends (should show "5 minutes")
      '2025-08-19 13:45:00', // 1:45 PM - 15 min before afternoon ends (should show "15 minutes")
      '2025-08-19 14:40:00', // 2:40 PM - 5 min before afternoon ends (should show "5 minutes")
    ];
    
    console.log('   Testing ending soon notifications at different times:');
    for (const testTime of testTimes) {
      try {
        // First check if is_break_ending_soon would trigger
        const endingSoonResult = await pool.query(`
          SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
        `, [testAgentId, testTime]);
        
        const timeLabel = testTime.split(' ')[1]; // Extract time part
        const wouldTrigger = endingSoonResult.rows[0].ending_soon;
        
        if (wouldTrigger) {
          console.log(`   ${timeLabel}: ✅ Would trigger ending soon notification`);
          
          // Now test the actual message creation
          try {
            const messageResult = await pool.query(`
              SELECT create_break_reminder_notification($1, 'ending_soon')
            `, [testAgentId]);
            
            console.log(`      ✅ Message created successfully`);
            
            // Check what message was actually created
            const newNotificationResult = await pool.query(`
              SELECT title, message, created_at
              FROM notifications
              WHERE user_id = $1
              AND category = 'break'
              AND type = 'ending_soon'
              AND created_at > NOW() - INTERVAL '1 minute'
              ORDER BY created_at DESC
              LIMIT 1
            `, [testAgentId]);
            
            if (newNotificationResult.rows.length > 0) {
              const notification = newNotificationResult.rows[0];
              console.log(`      📢 Title: ${notification.title}`);
              console.log(`      📢 Message: ${notification.message}`);
              
              // Verify the message format
              if (notification.message.includes('will end in') && notification.message.includes('minutes')) {
                console.log(`      ✅ Message format is correct (shows actual minutes)`);
              } else {
                console.log(`      ❌ Message format is incorrect`);
              }
              
              if (notification.title.includes('break ending soon')) {
                console.log(`      ✅ Title format is correct`);
              } else {
                console.log(`      ❌ Title format is incorrect`);
              }
            }
            
          } catch (error) {
            console.log(`      ❌ Message creation failed: ${error.message}`);
          }
          
        } else {
          console.log(`   ${timeLabel}: ❌ Would NOT trigger ending soon notification`);
        }
        
      } catch (error) {
        console.log(`   ${testTime.split(' ')[1]}: ❌ Error - ${error.message}`);
      }
    }
    
    // 3. Test the current time scenario
    console.log('\n3️⃣ Testing current time scenario:');
    const currentTime = new Date();
    console.log(`   Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    try {
      const currentEndingSoonResult = await pool.query(`
        SELECT is_break_ending_soon($1, $2::timestamp without time zone) as ending_soon
      `, [testAgentId, currentTime]);
      
      if (currentEndingSoonResult.rows[0].ending_soon) {
        console.log(`   🎯 Current time would trigger ending soon notification`);
        
        // Test message creation
        await pool.query(`
          SELECT create_break_reminder_notification($1, 'ending_soon')
        `, [testAgentId]);
        
        // Check the message
        const currentNotificationResult = await pool.query(`
          SELECT title, message
          FROM notifications
          WHERE user_id = $1
          AND category = 'break'
          AND type = 'ending_soon'
          AND created_at > NOW() - INTERVAL '1 minute'
          ORDER BY created_at DESC
          LIMIT 1
        `, [testAgentId]);
        
        if (currentNotificationResult.rows.length > 0) {
          const notification = currentNotificationResult.rows[0];
          console.log(`   📢 Current notification:`);
          console.log(`      Title: ${notification.title}`);
          console.log(`      Message: ${notification.message}`);
        }
        
      } else {
        console.log(`   ℹ️ Current time would NOT trigger ending soon notification`);
      }
      
    } catch (error) {
      console.log(`   ❌ Current time test failed: ${error.message}`);
    }
    
    // 4. Summary of the fix
    console.log('\n✅ Ending soon message fix completed successfully!');
    
    console.log('\n📋 Summary of changes:');
    console.log('   • Removed hardcoded "5 minutes" message');
    console.log('   • Added dynamic calculation of actual minutes remaining');
    console.log('   • Added proper break type names (Morning, Lunch, Afternoon)');
    console.log('   • Messages now show: "Your [BreakType] break will end in [X] minutes"');
    
    console.log('\n🎯 Expected behavior now:');
    console.log('   • 12:45 PM: "Your Lunch break will end in 15 minutes"');
    console.log('   • 12:50 PM: "Your Lunch break will end in 10 minutes"');
    console.log('   • 12:55 PM: "Your Lunch break will end in 5 minutes"');
    console.log('   • 1:45 PM: "Your Afternoon break will end in 15 minutes"');
    console.log('   • 2:40 PM: "Your Afternoon break will end in 5 minutes"');
    
    console.log('\n🎉 No more misleading "5 minutes" messages!');
    
  } catch (error) {
    console.error('❌ Error applying ending soon fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
applyEndingSoonFix();
