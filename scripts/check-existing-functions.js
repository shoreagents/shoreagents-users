const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkExistingFunctions() {
  console.log('🔍 Checking Existing Break Notification Functions\n');
  
  try {
    // Check all break-related functions
    const allFunctions = await pool.query(`
      SELECT 
        proname,
        oidvectortypes(proargtypes) as args,
        prosrc IS NOT NULL as has_source
      FROM pg_proc 
      WHERE proname LIKE '%break%' OR proname LIKE '%notification%'
      ORDER BY proname
    `);
    
    console.log(`   • Found ${allFunctions.rows.length} break/notification functions:`);
    allFunctions.rows.forEach((func, index) => {
      console.log(`     ${index + 1}. ${func.proname}(${func.args}) - Has source: ${func.has_source}`);
    });
    
    // Check specific functions we need
    console.log('\n2️⃣ Checking specific required functions...');
    const requiredFunctions = [
      'is_break_available_now',
      'is_break_available_soon', 
      'is_break_ending_soon',
      'is_break_missed',
      'create_break_reminder_notification',
      'check_break_reminders'
    ];
    
    for (const funcName of requiredFunctions) {
      const funcExists = await pool.query(`
        SELECT proname, oidvectortypes(proargtypes) as args
        FROM pg_proc 
        WHERE proname = $1
      `, [funcName]);
      
      if (funcExists.rows.length > 0) {
        console.log(`   ✅ ${funcName}: ${funcExists.rows[0].args}`);
      } else {
        console.log(`   ❌ ${funcName}: MISSING`);
      }
    }
    
    // Test what we can actually call
    console.log('\n3️⃣ Testing what functions we can call...');
    
    try {
      const testAvailableNow = await pool.query(`SELECT is_break_available_now(2, 'Lunch'::break_type_enum)`);
      console.log(`   ✅ is_break_available_now(2, 'Lunch') works: ${testAvailableNow.rows[0].is_break_available_now}`);
    } catch (error) {
      console.log(`   ❌ is_break_available_now error: ${error.message}`);
    }
    
    try {
      const testScheduler = await pool.query(`SELECT check_break_reminders()`);
      console.log(`   ✅ check_break_reminders() works: ${testScheduler.rows[0].check_break_reminders}`);
    } catch (error) {
      console.log(`   ❌ check_break_reminders error: ${error.message}`);
    }
    
    // Check if we can create notifications manually
    console.log('\n4️⃣ Testing notification creation...');
    try {
      const testNotif = await pool.query(`
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES (2, 'break', 'info', 'Test Notification', 'This is a test', '{"test": true}')
        RETURNING id
      `);
      console.log(`   ✅ Created test notification with ID: ${testNotif.rows[0].id}`);
      
      // Clean up test notification
      await pool.query(`DELETE FROM notifications WHERE id = $1`, [testNotif.rows[0].id]);
      console.log(`   ✅ Cleaned up test notification`);
      
    } catch (error) {
      console.log(`   ❌ Notification creation error: ${error.message}`);
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('   • We have basic functions but missing some key ones');
    console.log('   • Need to create: is_break_available_soon, create_break_reminder_notification');
    console.log('   • Current functions work but are limited');
    
  } catch (error) {
    console.error('❌ Error checking functions:', error.message);
  } finally {
    await pool.end();
  }
}

checkExistingFunctions();
