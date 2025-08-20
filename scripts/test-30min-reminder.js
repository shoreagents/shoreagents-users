const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function test30MinReminder() {
  try {
    console.log('🧪 Testing 30-minute reminder at 3:15 PM:\n');
    
    const testAgentId = 2;
    const testTime = '2025-08-20 15:15:00'; // 3:15 PM
    
    const result = await pool.query(`
      SELECT is_break_reminder_due($1, 'Afternoon', $2::timestamp without time zone) as reminder_due
    `, [testAgentId, testTime]);
    
    const isReminderDue = result.rows[0].reminder_due;
    console.log(`3:15 PM (15:15:00) - 30 min reminder due: ${isReminderDue ? '✅ TRUE' : '❌ FALSE'}`);
    console.log('Expected: ✅ TRUE (30 minutes after 2:45 PM start)');
    
    if (isReminderDue) {
      console.log('\n🎉 SUCCESS! 30-minute reminder function is working');
    } else {
      console.log('\n❌ The 30-minute reminder function needs adjustment');
      console.log('Let me check the logic...');
      
      // Check minutes since start
      const debugResult = await pool.query(`
        SELECT 
          EXTRACT(EPOCH FROM ('15:15:00'::TIME - '14:45:00'::TIME)) / 60 as minutes_since_start,
          EXTRACT(MINUTE FROM '15:15:00'::TIME) as current_minute,
          EXTRACT(MINUTE FROM '15:15:00'::TIME) % 30 as minute_mod_30
      `);
      
      const debug = debugResult.rows[0];
      console.log(`Minutes since start: ${debug.minutes_since_start}`);
      console.log(`Current minute: ${debug.current_minute}`);
      console.log(`Minute mod 30: ${debug.minute_mod_30}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

test30MinReminder();
