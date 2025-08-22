const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakDuplicateFix() {
  console.log('🔧 Applying break notification duplicate fix...\n');
  
  try {
    // 1. Apply the migration
    console.log('1️⃣ Applying migration 047_fix_break_available_now_duplicates.sql...');
    
    const migrationPath = './migrations/047_fix_break_available_now_duplicates.sql';
    const fs = require('fs');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');
    
    // 2. Test the new function
    console.log('\n2️⃣ Testing the new is_break_available_now_notification_sent function...');
    
    const testFunction = await pool.query(`
      SELECT is_break_available_now_notification_sent(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result
    `);
    console.log(`   ✅ Function works: ${testFunction.rows[0].result}`);
    
    // 3. Test the updated check_break_reminders function
    console.log('\n3️⃣ Testing the updated check_break_reminders function...');
    
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    console.log(`   ✅ Function executed: ${notificationsSent} notifications sent`);
    
    // 4. Verify the functions exist
    console.log('\n4️⃣ Verifying all functions exist...');
    
    const functionCheck = await pool.query(`
      SELECT proname, proargtypes::regtype[] as arg_types
      FROM pg_proc 
      WHERE proname IN ('is_break_available_now_notification_sent', 'check_break_reminders', 'create_break_reminder_notification')
      ORDER BY proname
    `);
    
    console.log('   ✅ Functions found:');
    functionCheck.rows.forEach(row => {
      console.log(`      • ${row.proname} - ${Array.isArray(row.arg_types) ? row.arg_types.join(', ') : 'unknown args'}`);
    });
    
    // 5. Test the fix by checking if duplicate prevention works
    console.log('\n5️⃣ Testing duplicate prevention...');
    
    // Run check_break_reminders multiple times to ensure no duplicates
    for (let i = 1; i <= 3; i++) {
      const testResult = await pool.query('SELECT check_break_reminders()');
      const testNotifications = testResult.rows[0].check_break_reminders;
      console.log(`   • Run ${i}: ${testNotifications} notifications sent`);
      
      if (testNotifications === 0) {
        console.log('   ✅ Duplicate prevention working - no additional notifications sent');
      }
    }
    
    console.log('\n🎉 Break notification duplicate fix applied successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Added is_break_available_now_notification_sent() function');
    console.log('   • Updated check_break_reminders() to only send "available_now" once per break period');
    console.log('   • Prevents multiple "Lunch break is now available" notifications every hour');
    console.log('   • Now sends "available_now" notification only once when break first becomes available');
    
  } catch (error) {
    console.error('❌ Error applying break duplicate fix:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  applyBreakDuplicateFix()
    .then(() => {
      console.log('\n✅ Break duplicate fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Break duplicate fix failed:', error.message);
      process.exit(1);
    });
}

module.exports = { applyBreakDuplicateFix };
