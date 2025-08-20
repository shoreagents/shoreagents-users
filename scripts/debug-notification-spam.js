const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugNotificationSpam() {
  const client = await pool.connect();
  try {
    console.log('🚨 Debugging notification spam issue...\n');
    
    // 1. Check current notifications count and timing
    console.log('1️⃣ Checking notification spam pattern...');
    
    const recentNotifications = await client.query(`
      SELECT 
        id,
        user_id,
        type,
        title,
        message,
        payload,
        created_at,
        EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as seconds_between
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '2 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    if (recentNotifications.rows.length > 0) {
      console.log(`   Found ${recentNotifications.rows.length} recent break notifications:`);
      recentNotifications.rows.forEach((notif, index) => {
        const timeStr = notif.created_at.toLocaleString();
        const secondsBetween = notif.seconds_between ? Math.round(notif.seconds_between) : 'N/A';
        console.log(`     ${index + 1}. ID: ${notif.id} - ${notif.title} (${notif.type})`);
        console.log(`        Time: ${timeStr} | Seconds since previous: ${secondsBetween}`);
        console.log(`        Message: ${notif.message}`);
        console.log(`        Payload: ${notif.payload}`);
        console.log('');
      });
    }
    
    // 2. Check what break types are being triggered
    console.log('2️⃣ Analyzing break types being triggered...');
    
    const breakTypeAnalysis = await client.query(`
      SELECT 
        payload->>'break_type' as break_type,
        COUNT(*) as count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM notifications
      WHERE category = 'break'
      AND created_at > NOW() - INTERVAL '2 hours'
      GROUP BY payload->>'break_type'
      ORDER BY count DESC
    `);
    
    if (breakTypeAnalysis.rows.length > 0) {
      console.log('   Break type distribution:');
      breakTypeAnalysis.rows.forEach((row, index) => {
        console.log(`     ${index + 1}. ${row.break_type}: ${row.count} notifications`);
        console.log(`        First: ${row.first_occurrence.toLocaleString()}`);
        console.log(`        Last: ${row.last_occurrence.toLocaleString()}`);
      });
    }
    
    // 3. Check the is_break_reminder_due function logic
    console.log('\n3️⃣ Checking is_break_reminder_due function...');
    
    try {
      const functionExists = await client.query(`
        SELECT proname, prosrc 
        FROM pg_proc 
        WHERE proname = 'is_break_reminder_due'
      `);
      
      if (functionExists.rows.length > 0) {
        console.log('   ✅ Function exists');
        console.log('   Function source preview:');
        const source = functionExists.rows[0].prosrc;
        const lines = source.split('\n').slice(0, 15);
        lines.forEach((line, index) => {
          console.log(`      ${index + 1}: ${line}`);
        });
        if (source.split('\n').length > 15) {
          console.log('      ... (truncated)');
        }
      } else {
        console.log('   ❌ Function does not exist');
      }
    } catch (funcError) {
      console.log(`   Error checking function: ${funcError.message}`);
    }
    
    // 4. Test the function at current time
    console.log('\n4️⃣ Testing is_break_reminder_due function...');
    
    try {
      // Test for Lunch break
      const lunchTest = await client.query(`
        SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum) as result
      `);
      console.log(`   Lunch break reminder due: ${lunchTest.rows[0].result}`);
      
      // Test for Night Meal break
      const nightMealTest = await client.query(`
        SELECT is_break_reminder_due(2, 'NightMeal'::break_type_enum) as result
      `);
      console.log(`   Night Meal break reminder due: ${nightMealTest.rows[0].result}`);
      
      // Test for Morning break
      const morningTest = await client.query(`
        SELECT is_break_reminder_due(2, 'Morning'::break_type_enum) as result
      `);
      console.log(`   Morning break reminder due: ${morningTest.rows[0].result}`);
      
    } catch (testError) {
      console.log(`   ❌ Function test failed: ${testError.message}`);
    }
    
    // 5. Check User 2's current shift and break windows
    console.log('\n5️⃣ Checking User 2 shift and break windows...');
    
    try {
      const shiftInfo = await client.query(`
        SELECT * FROM get_agent_shift_info(2)
      `);
      
      if (shiftInfo.rows.length > 0) {
        const shift = shiftInfo.rows[0];
        console.log(`   Shift: ${shift.shift_time} (${shift.shift_period})`);
        console.log(`   Schedule: ${shift.shift_schedule}`);
        
        // Calculate break windows
        const breakWindows = await client.query(`
          SELECT * FROM calculate_break_windows(2)
        `);
        
        if (breakWindows.rows.length > 0) {
          console.log('   Break windows:');
          breakWindows.rows.forEach((window, index) => {
            console.log(`     ${index + 1}. ${window.break_type}: ${window.start_time} - ${window.end_time}`);
          });
        }
      } else {
        console.log('   ❌ No shift info found for User 2');
      }
    } catch (shiftError) {
      console.log(`   Error checking shift: ${shiftError.message}`);
    }
    
    // 6. Check if there are multiple scheduler processes
    console.log('\n6️⃣ Checking for multiple scheduler processes...');
    
    try {
      const { exec } = require('child_process');
      exec('ps aux | grep "break-reminder-scheduler" | grep -v grep', (error, stdout, stderr) => {
        if (stdout) {
          const processes = stdout.trim().split('\n');
          console.log(`   Found ${processes.length} scheduler processes:`);
          processes.forEach((process, index) => {
            console.log(`     ${index + 1}. ${process.trim()}`);
          });
          
          if (processes.length > 1) {
            console.log('   🚨 MULTIPLE SCHEDULERS RUNNING - This could cause spam!');
          }
        } else {
          console.log('   ❌ No scheduler processes found');
        }
      });
    } catch (error) {
      console.log(`   Error checking processes: ${error.message}`);
    }
    
    // 7. Check the check_break_reminders function
    console.log('\n7️⃣ Checking check_break_reminders function...');
    
    try {
      const functionExists = await client.query(`
        SELECT proname, prosrc 
        FROM pg_proc 
        WHERE proname = 'check_break_reminders'
      `);
      
      if (functionExists.rows.length > 0) {
        console.log('   ✅ Function exists');
        console.log('   Function source preview:');
        const source = functionExists.rows[0].prosrc;
        const lines = source.split('\n').slice(0, 15);
        lines.forEach((line, index) => {
          console.log(`      ${index + 1}: ${line}`);
        });
        if (source.split('\n').length > 15) {
          console.log('      ... (truncated)');
        }
      } else {
        console.log('   ❌ Function does not exist');
      }
    } catch (funcError) {
      console.log(`   Error checking function: ${funcError.message}`);
    }
    
    // 8. Summary and recommendations
    console.log('\n🎯 Summary of Issues:');
    console.log('   ❌ Notifications being sent every minute instead of every 30 minutes');
    console.log('   ❌ Duplicate notifications for same break types');
    console.log('   ❌ Wrong break types being triggered (Night Meal during day)');
    console.log('   ❌ Possible multiple scheduler processes running');
    
    console.log('\n🔧 Recommended Fixes:');
    console.log('   1. Stop all scheduler processes');
    console.log('   2. Fix the is_break_reminder_due function logic');
    console.log('   3. Add duplicate prevention in check_break_reminders');
    console.log('   4. Restart single scheduler process');
    
  } catch (error) {
    console.error('\n❌ Error debugging notification spam:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the debug
debugNotificationSpam();
