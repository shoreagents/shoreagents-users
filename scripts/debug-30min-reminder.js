const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debug30MinReminder() {
  try {
    console.log('🔍 Debugging 30-minute Reminder Function...\n');
    
    const testAgentId = 2; // kyle.p@shoreagents.com
    
    // Test cases for 30-minute reminders
    const testCases = [
      { time: '2025-08-20 09:30:00', label: '9:30 AM', breakType: 'Morning', description: '30 min after 9:00 AM start' },
      { time: '2025-08-20 11:30:00', label: '11:30 AM', breakType: 'Lunch', description: '30 min after 11:00 AM start' },
      { time: '2025-08-20 15:15:00', label: '3:15 PM', breakType: 'Afternoon', description: '30 min after 2:45 PM start' }
    ];
    
    for (const testCase of testCases) {
      console.log(`🕐 Testing ${testCase.label} - ${testCase.breakType} Break:`);
      console.log(`   ${testCase.description}`);
      
      try {
        // Get the break window for this break type
        const breakWindowResult = await pool.query(`
          SELECT * FROM calculate_break_windows($1) WHERE break_type = $2
        `, [testAgentId, testCase.breakType]);
        
        if (breakWindowResult.rows.length > 0) {
          const window = breakWindowResult.rows[0];
          console.log(`   Break window: ${window.start_time} - ${window.end_time}`);
          
          // Test the reminder function
          const reminderResult = await pool.query(`
            SELECT is_break_reminder_due($1, $2, $3::timestamp without time zone) as reminder_due
          `, [testAgentId, testCase.breakType, testCase.time]);
          
          const isReminderDue = reminderResult.rows[0].reminder_due;
          console.log(`   is_break_reminder_due result: ${isReminderDue ? '✅ TRUE' : '❌ FALSE'}`);
          
          // Manual calculation to see what should happen
          const testTimeOnly = testCase.time.split(' ')[1]; // Extract time part
          const startTimeOnly = window.start_time;
          
          const testTimeObj = new Date(`2025-08-20 ${testTimeOnly}`);
          const startTimeObj = new Date(`2025-08-20 ${startTimeOnly}`);
          const minutesSinceStart = Math.round((testTimeObj - startTimeObj) / (1000 * 60));
          
          console.log(`   Minutes since start: ${minutesSinceStart}`);
          console.log(`   Should trigger if between 28-32 minutes: ${minutesSinceStart >= 28 && minutesSinceStart <= 32 ? 'YES' : 'NO'}`);
          
          // Check for recent notifications
          const recentNotifResult = await pool.query(`
            SELECT 
              COUNT(*) as count,
              MAX(created_at) as last_notification
            FROM notifications
            WHERE user_id = $1
            AND category = 'break'
            AND type = 'reminder'
            AND created_at > CURRENT_DATE
          `, [testAgentId]);
          
          const recentNotif = recentNotifResult.rows[0];
          console.log(`   Recent reminder notifications today: ${recentNotif.count}`);
          if (recentNotif.last_notification) {
            console.log(`   Last reminder notification: ${recentNotif.last_notification}`);
          }
          
          // Check timezone handling
          const timezoneResult = await pool.query(`
            SELECT 
              $1::timestamp without time zone as input_timestamp,
              ($1::timestamp without time zone)::TIME as extracted_time,
              NOW() as current_utc,
              (NOW() AT TIME ZONE 'Asia/Manila') as current_manila,
              (NOW() AT TIME ZONE 'Asia/Manila')::TIME as current_manila_time
          `, [testCase.time]);
          
          const tz = timezoneResult.rows[0];
          console.log(`   Input timestamp: ${tz.input_timestamp}`);
          console.log(`   Extracted time: ${tz.extracted_time}`);
          console.log(`   Current UTC: ${tz.current_utc}`);
          console.log(`   Current Manila: ${tz.current_manila}`);
          console.log(`   Current Manila time: ${tz.current_manila_time}`);
          
        } else {
          console.log(`   ❌ No break window found for ${testCase.breakType}`);
        }
        
        console.log('');
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging 30-minute reminder:', error.message);
  } finally {
    await pool.end();
  }
}

debug30MinReminder();
