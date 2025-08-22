const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakReminderTimingFix() {
  console.log('🔧 Applying break reminder timing fix...\n');
  
  try {
    // 1. Apply the migration
    console.log('1️⃣ Applying migration 048_fix_break_reminder_timing.sql...');
    
    const migrationPath = './migrations/048_fix_break_reminder_timing.sql';
    const fs = require('fs');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');
    
    // 2. Test the fixed function
    console.log('\n2️⃣ Testing the fixed is_break_reminder_due function...');
    
    const testFunction = await pool.query(`
      SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, NOW() AT TIME ZONE 'Asia/Manila') as result
    `);
    console.log(`   ✅ Function works: ${testFunction.rows[0].result}`);
    
    // 3. Test with different times to verify 30-minute intervals
    console.log('\n3️⃣ Testing 30-minute interval logic...');
    
    // Test at 30 minutes after break start (should return true)
    const test30min = await pool.query(`
      SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, 
        (CURRENT_DATE + (SPLIT_PART(shift_time, ' - ', 1))::time + INTERVAL '4 hours 30 minutes')
      ) as at_30min
      FROM job_info WHERE agent_user_id = 2
    `);
    console.log(`   • At 30 minutes: ${test30min.rows[0].at_30min}`);
    
    // Test at 60 minutes after break start (should return true)
    const test60min = await pool.query(`
      SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, 
        (CURRENT_DATE + (SPLIT_PART(shift_time, ' - ', 1))::time + INTERVAL '5 hours')
      ) as at_60min
      FROM job_info WHERE agent_user_id = 2
    `);
    console.log(`   • At 60 minutes: ${test60min.rows[0].at_60min}`);
    
    // Test at 90 minutes after break start (should return true)
    const test90min = await pool.query(`
      SELECT is_break_reminder_due(2, 'Lunch'::break_type_enum, 
        (CURRENT_DATE + (SPLIT_PART(shift_time, ' - ', 1))::time + INTERVAL '5 hours 30 minutes')
      ) as at_90min
      FROM job_info WHERE agent_user_id = 2
    `);
    console.log(`   • At 90 minutes: ${test90min.rows[0].at_90min}`);
    
    // 4. Test the complete check_break_reminders function
    console.log('\n4️⃣ Testing the complete check_break_reminders function...');
    
    const reminderResult = await pool.query('SELECT check_break_reminders()');
    const notificationsSent = reminderResult.rows[0].check_break_reminders;
    console.log(`   ✅ Function executed: ${notificationsSent} notifications sent`);
    
    // 5. Verify the function exists
    console.log('\n5️⃣ Verifying function exists...');
    
    const functionCheck = await pool.query(`
      SELECT proname, proargtypes::regtype[] as arg_types
      FROM pg_proc 
      WHERE proname = 'is_break_reminder_due'
      ORDER BY proname
    `);
    
    console.log('   ✅ Function found:');
    functionCheck.rows.forEach(row => {
      console.log(`      • ${row.proname} - ${Array.isArray(row.arg_types) ? row.arg_types.join(', ') : 'unknown args'}`);
    });
    
    console.log('\n🎉 Break reminder timing fix applied successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Updated is_break_reminder_due() to send reminders every 30 minutes');
    console.log('   • First reminder at 30 minutes, then every 30 minutes after that');
    console.log('   • Minimum 20-minute gap between notifications to prevent spam');
    console.log('   • 5-minute tolerance for scheduler timing variations');
    console.log('   • Now you should receive "missed break" notifications at 10:30 AM, 11:00 AM, 11:30 AM, etc.');
    
  } catch (error) {
    console.error('❌ Error applying break reminder timing fix:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  applyBreakReminderTimingFix()
    .then(() => {
      console.log('\n✅ Break reminder timing fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Break reminder timing fix failed:', error.message);
      process.exit(1);
    });
}

module.exports = { applyBreakReminderTimingFix };
