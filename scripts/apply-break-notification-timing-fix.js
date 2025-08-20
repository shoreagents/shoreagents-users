const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyBreakNotificationTimingFix() {
  const client = await pool.connect();
  try {
    console.log('🔧 Applying break notification timing fix...\n');
    
    await client.query('BEGIN');
    
    // Read and apply the SQL fix
    const fs = require('fs');
    const sqlFix = fs.readFileSync('./scripts/fix-break-notification-timing.sql', 'utf8');
    
    console.log('   🔄 Applying break notification timing fixes...');
    await client.query(sqlFix);
    
    console.log('   ✅ Break notification timing functions updated');
    
    // Test the functions to make sure they work
    console.log('\n   🧪 Testing updated functions...');
    
    // Test is_break_available_soon
    const testAvailableSoon = await client.query(`
      SELECT is_break_available_soon(1, 'Morning', '2025-01-20 07:45:00'::timestamp)
    `);
    console.log(`      is_break_available_soon at 7:45 AM: ${testAvailableSoon.rows[0].is_break_available_soon}`);
    
    // Test is_break_available_now
    const testAvailableNow = await client.query(`
      SELECT is_break_available_now(1, 'Morning', '2025-01-20 08:00:00'::timestamp)
    `);
    console.log(`      is_break_available_now at 8:00 AM: ${testAvailableNow.rows[0].is_break_available_now}`);
    
    // Test is_break_reminder_due
    const testReminderDue = await client.query(`
      SELECT is_break_reminder_due(1, 'Morning', '2025-01-20 08:30:00'::timestamp)
    `);
    console.log(`      is_break_reminder_due at 8:30 AM: ${testReminderDue.rows[0].is_break_reminder_due}`);
    
    // Test is_break_window_ending_soon
    const testEndingSoon = await client.query(`
      SELECT is_break_window_ending_soon(1, 'Morning', '2025-01-20 08:45:00'::timestamp)
    `);
    console.log(`      is_break_window_ending_soon at 8:45 AM: ${testEndingSoon.rows[0].is_break_window_ending_soon}`);
    
    await client.query('COMMIT');
    
    console.log('\n🎯 Break notification timing fix applied successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   • is_break_available_soon: Now fires reliably at 15 minutes before break start');
    console.log('   • is_break_available_now: Now fires at exact break start time');
    console.log('   • is_break_reminder_due: Now fires every 30 minutes during break window');
    console.log('   • is_break_window_ending_soon: Now fires at 15 minutes before break window ends');
    console.log('\n⏰ Expected notification timing for Morning Break (8:00-9:00 AM):');
    console.log('   • 7:45 AM: "Morning Break will be available in 15 minutes"');
    console.log('   • 8:00 AM: "Morning break is now available"');
    console.log('   • 8:30 AM: "You have not taken your morning break yet!"');
    console.log('   • 8:45 AM: "Morning break will be ending soon"');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error applying break notification timing fix:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await applyBreakNotificationTimingFix();
  } catch (error) {
    console.error('❌ Failed to apply break notification timing fix:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { applyBreakNotificationTimingFix };
