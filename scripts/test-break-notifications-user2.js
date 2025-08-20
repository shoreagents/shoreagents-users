const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakNotificationsUser2() {
  const client = await pool.connect();
  try {
    console.log('🧪 Testing break notification functions with User 2 (kyle.p@shoreagents.com)...\n');
    
    // User 2 has shift: 6:00 AM - 3:00 PM
    // Break windows:
    // Morning: 8:00 AM - 9:00 AM
    // Lunch: 10:00 AM - 1:00 PM  
    // Afternoon: 1:45 PM - 2:45 PM
    
    console.log('📋 User 2 Shift Configuration:');
    console.log('   Shift: 6:00 AM - 3:00 PM');
    console.log('   Morning Break: 8:00 AM - 9:00 AM');
    console.log('   Lunch Break: 10:00 AM - 1:00 PM');
    console.log('   Afternoon Break: 1:45 PM - 2:45 PM\n');
    
    console.log('🔍 Testing break notification functions at specific times:\n');
    
    // Test Morning Break notifications
    console.log('🌅 Morning Break (8:00-9:00 AM):');
    
    // 7:45 AM - Should trigger "available soon"
    const test745 = await client.query(`
      SELECT is_break_available_soon(2, 'Morning', '2025-01-20 07:45:00'::timestamp)
    `);
    console.log(`   7:45 AM - Available soon: ${test745.rows[0].is_break_available_soon}`);
    
    // 8:00 AM - Should trigger "available now"
    const test800 = await client.query(`
      SELECT is_break_available_now(2, 'Morning', '2025-01-20 08:00:00'::timestamp)
    `);
    console.log(`   8:00 AM - Available now: ${test800.rows[0].is_break_available_now}`);
    
    // 8:30 AM - Should trigger 30-min reminder
    const test830 = await client.query(`
      SELECT is_break_reminder_due(2, 'Morning', '2025-01-20 08:30:00'::timestamp)
    `);
    console.log(`   8:30 AM - 30-min reminder: ${test830.rows[0].is_break_reminder_due}`);
    
    // 8:45 AM - Should trigger "ending soon"
    const test845 = await client.query(`
      SELECT is_break_window_ending_soon(2, 'Morning', '2025-01-20 08:45:00'::timestamp)
    `);
    console.log(`   8:45 AM - Ending soon: ${test845.rows[0].is_break_window_ending_soon}`);
    
    // Test Lunch Break notifications
    console.log('\n🍽️  Lunch Break (10:00 AM-1:00 PM):');
    
    // 9:45 AM - Should trigger "available soon"
    const test945 = await client.query(`
      SELECT is_break_available_soon(2, 'Lunch', '2025-01-20 09:45:00'::timestamp)
    `);
    console.log(`   9:45 AM - Available soon: ${test945.rows[0].is_break_available_soon}`);
    
    // 10:00 AM - Should trigger "available now"
    const test1000 = await client.query(`
      SELECT is_break_available_now(2, 'Lunch', '2025-01-20 10:00:00'::timestamp)
    `);
    console.log(`   10:00 AM - Available now: ${test1000.rows[0].is_break_available_now}`);
    
    // 10:30 AM - Should trigger 30-min reminder
    const test1030 = await client.query(`
      SELECT is_break_reminder_due(2, 'Lunch', '2025-01-20 10:30:00'::timestamp)
    `);
    console.log(`   10:30 AM - 30-min reminder: ${test1030.rows[0].is_break_reminder_due}`);
    
    // 12:45 PM - Should trigger "ending soon"
    const test1245 = await client.query(`
      SELECT is_break_window_ending_soon(2, 'Lunch', '2025-01-20 12:45:00'::timestamp)
    `);
    console.log(`   12:45 PM - Ending soon: ${test1245.rows[0].is_break_window_ending_soon}`);
    
    // Test Afternoon Break notifications
    console.log('\n🌆 Afternoon Break (1:45-2:45 PM):');
    
    // 1:30 PM - Should trigger "available soon"
    const test130 = await client.query(`
      SELECT is_break_available_soon(2, 'Afternoon', '2025-01-20 13:30:00'::timestamp)
    `);
    console.log(`   1:30 PM - Available soon: ${test130.rows[0].is_break_available_soon}`);
    
    // 1:45 PM - Should trigger "available now"
    const test145 = await client.query(`
      SELECT is_break_available_now(2, 'Afternoon', '2025-01-20 13:45:00'::timestamp)
    `);
    console.log(`   1:45 PM - Available now: ${test145.rows[0].is_break_available_now}`);
    
    // 2:15 PM - Should trigger 30-min reminder
    const test215 = await client.query(`
      SELECT is_break_reminder_due(2, 'Afternoon', '2025-01-20 14:15:00'::timestamp)
    `);
    console.log(`   2:15 PM - 30-min reminder: ${test215.rows[0].is_break_reminder_due}`);
    
    // 2:30 PM - Should trigger "ending soon"
    const test230 = await client.query(`
      SELECT is_break_window_ending_soon(2, 'Afternoon', '2025-01-20 14:30:00'::timestamp)
    `);
    console.log(`   2:30 PM - Ending soon: ${test230.rows[0].is_break_window_ending_soon}`);
    
    console.log('\n✅ Testing completed!');
    
  } catch (error) {
    console.error('❌ Error testing break notifications:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await testBreakNotificationsUser2();
  } catch (error) {
    console.error('❌ Failed to test break notifications:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { testBreakNotificationsUser2 };
