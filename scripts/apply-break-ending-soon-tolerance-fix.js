const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakEndingSoonToleranceFix() {
  try {
    console.log('🔧 Applying break ending soon tolerance fix...\n');
    
    // 1. Read and apply the migration
    console.log('1️⃣ Reading migration file...');
    const fs = require('fs');
    const migrationPath = 'migrations/054_fix_break_ending_soon_tolerance.sql';
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('   ✅ Migration file read successfully');
    
    // 2. Apply the migration
    console.log('\n2️⃣ Applying migration to database...');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');
    
    // 3. Test the updated function
    console.log('\n3️⃣ Testing the updated function...');
    
    // Test at different times to verify the wider tolerance
    const testTimes = [
      '12:42:00', // 18 minutes before 1:00 PM (should now trigger)
      '12:45:00', // 15 minutes before 1:00 PM (should trigger)
      '12:48:00', // 12 minutes before 1:00 PM (should now trigger)
    ];
    
    for (const timeStr of testTimes) {
      const testTime = new Date(`2025-08-26 ${timeStr}`);
      const testResult = await pool.query(`
        SELECT is_break_window_ending_soon(2, 'Lunch'::break_type_enum, $1::timestamp with time zone) as result
      `, [testTime]);
      
      const minutesUntilEnd = timeStr === '12:42:00' ? 18 : timeStr === '12:45:00' ? 15 : 12;
      console.log(`   • ${timeStr} (${minutesUntilEnd} min before end): ${testResult.rows[0].result ? '✅ YES' : '❌ NO'}`);
    }
    
    // 4. Test the check_break_reminders function
    console.log('\n4️⃣ Testing check_break_reminders function...');
    const reminderResult = await pool.query('SELECT check_break_reminders() as notifications_sent');
    console.log(`   • Notifications sent: ${reminderResult.rows[0].notifications_sent}`);
    
    // 5. Verify the function signature
    console.log('\n5️⃣ Verifying function signature...');
    const functionDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'is_break_window_ending_soon'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    
    if (functionDef.rows.length > 0) {
      const definition = functionDef.rows[0].definition;
      const hasWiderTolerance = definition.includes('minutes_until_expiry >= 12 AND minutes_until_expiry <= 18');
      console.log(`   • Function has wider tolerance (12-18 min): ${hasWiderTolerance ? '✅ YES' : '❌ NO'}`);
    }
    
    console.log('\n✅ Break ending soon tolerance fix applied successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   • Expanded tolerance window from 13-17 minutes to 12-18 minutes');
    console.log('   • This ensures lunch break ending soon notifications are sent reliably');
    console.log('   • The function will now trigger between 12:42 PM and 12:48 PM for a 1:00 PM lunch end');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error applying fix:', error.message);
    await pool.end();
    process.exit(1);
  }
}

applyBreakEndingSoonToleranceFix();
