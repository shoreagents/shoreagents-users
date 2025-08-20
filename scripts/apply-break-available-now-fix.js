const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakAvailableNowFix() {
  console.log('🔧 Applying break available now fix...\n');
  
  try {
    // 1. Test database connection
    console.log('1️⃣ Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('   ✅ Database connected successfully\n');
    
    // 2. Read and apply the migration
    console.log('2️⃣ Applying migration 046_add_break_available_now.sql...');
    const fs = require('fs');
    const migrationPath = './migrations/046_add_break_available_now.sql';
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully\n');
    
    // 3. Test the new is_break_available_now function
    console.log('3️⃣ Testing the new is_break_available_now function...');
    
    // Test with a sample user (assuming user_id 1 exists)
    const testResult = await pool.query(`
      SELECT 
        is_break_available_now(1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available_now,
        is_break_available_soon(1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') as lunch_available_soon
    `);
    
    console.log('   ✅ Function test results:');
    console.log(`      Lunch available now: ${testResult.rows[0].lunch_available_now}`);
    console.log(`      Lunch available soon: ${testResult.rows[0].lunch_available_soon}\n`);
    
    // 4. Test the updated check_break_reminders function
    console.log('4️⃣ Testing the updated check_break_reminders function...');
    
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    
    console.log(`   ✅ Function executed successfully - Notifications sent: ${notificationsSent}\n`);
    
    // 5. Verify the function exists and has the right signature
    console.log('5️⃣ Verifying function signatures...');
    
    const functionCheck = await pool.query(`
      SELECT 
        proname,
        pg_get_function_arguments(oid) as arguments,
        pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname IN ('is_break_available_now', 'check_break_reminders', 'create_break_reminder_notification')
      ORDER BY proname
    `);
    
    console.log('   ✅ Function signatures:');
    functionCheck.rows.forEach(row => {
      console.log(`      ${row.proname}(${row.arguments}) -> ${row.return_type}`);
    });
    
    console.log('\n🎉 Break available now fix applied successfully!');
    console.log('\n📋 What was added:');
    console.log('   • New function: is_break_available_now() - Checks if break is currently active');
    console.log('   • Updated check_break_reminders() - Now includes "available now" notifications');
    console.log('   • Updated create_break_reminder_notification() - Handles "available_now" type');
    console.log('\n🔔 Notification flow now includes:');
    console.log('   • "Break available soon" - 15 minutes before break starts (9:45 AM)');
    console.log('   • "Break is now available" - When break starts (10:00 AM)');
    console.log('   • "Break ending soon" - 5 minutes before break ends');
    
  } catch (error) {
    console.error('\n❌ Error applying break available now fix:', error.message);
    console.error('\n🔍 Error details:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the fix
applyBreakAvailableNowFix();
