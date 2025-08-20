const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentBreakWindows() {
  try {
    console.log('🔍 Current Break Windows in Database:\n');
    
    const result = await pool.query('SELECT * FROM calculate_break_windows(2) ORDER BY start_time');
    
    result.rows.forEach(window => {
      const startTime = window.start_time;
      const endTime = window.end_time;
      
      // Convert to 12-hour format
      const startHour = parseInt(startTime.split(':')[0]);
      const endHour = parseInt(endTime.split(':')[0]);
      
      let startAmPm = startHour >= 12 ? 'PM' : 'AM';
      let endAmPm = endHour >= 12 ? 'PM' : 'AM';
      
      let displayStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
      let displayEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
      
      console.log(`${window.break_type}: ${displayStartHour}:${startTime.split(':')[1]} ${startAmPm} - ${displayEndHour}:${endTime.split(':')[1]} ${endAmPm}`);
    });
    
    console.log('\n📝 User said Morning break should be: 9:00 AM - 10:00 AM');
    console.log('🔧 Need to update the Morning break timing in the database');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkCurrentBreakWindows();
