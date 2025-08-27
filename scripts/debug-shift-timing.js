const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugShiftTiming() {
  try {
    console.log('🔍 Debugging Shift Timing...');
    
    // Check current time
    const now = new Date();
    console.log(`⏰ Current UTC time: ${now.toISOString()}`);
    console.log(`🌍 Manila time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    
    // Get agent shift information
    const shiftInfo = await pool.query(`
      SELECT 
        u.id AS user_id,
        u.email,
        ji.shift_time,
        ji.employee_id
      FROM users u
      JOIN agents a ON a.user_id = u.id
      LEFT JOIN job_info ji ON ji.agent_user_id = u.id
      WHERE u.user_type = 'Agent' AND u.id = 2
    `);
    
    if (shiftInfo.rows.length > 0) {
      const agent = shiftInfo.rows[0];
      console.log(`\n👤 Agent: ${agent.email}`);
      console.log(`⏰ Shift time: ${agent.shift_time}`);
      
      // Parse shift time manually
      const shiftText = agent.shift_time;
      if (shiftText && shiftText.match(/(\d{1,2}:\d{2}\s*(AM|PM)).*-(.*\d{1,2}:\d{2}\s*(AM|PM))/)) {
        const startMatch = shiftText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
        const startHour = parseInt(startMatch[1]);
        const startMinute = parseInt(startMatch[2]);
        const startAMPM = startMatch[3];
        
        let startHour24 = startHour;
        if (startAMPM === 'PM' && startHour !== 12) startHour24 += 12;
        if (startAMPM === 'AM' && startHour === 12) startHour24 = 0;
        
        const startMinutes = startHour24 * 60 + startMinute;
        console.log(`🔢 Start time: ${startHour}:${startMinute.toString().padStart(2, '0')} ${startAMPM} (${startMinutes} minutes from midnight)`);
        
        // Calculate today's shift start time
        const today = new Date();
        const manilaTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const todayDate = manilaTime.toISOString().split('T')[0];
        
        const shiftStartTime = new Date(`${todayDate}T${startHour24.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:00`);
        console.log(`📅 Today's shift start: ${shiftStartTime.toISOString()}`);
        
        // Calculate time difference
        const timeDiffMs = now.getTime() - shiftStartTime.getTime();
        const timeDiffSeconds = Math.abs(timeDiffMs / 1000);
        const timeDiffMinutes = timeDiffSeconds / 60;
        
        console.log(`⏱️  Time difference: ${timeDiffMinutes.toFixed(2)} minutes (${timeDiffSeconds.toFixed(0)} seconds)`);
        console.log(`🎯 Within 10 minutes: ${timeDiffMinutes <= 10 ? 'YES' : 'NO'}`);
        console.log(`🎯 Within 1 hour: ${timeDiffMinutes <= 60 ? 'YES' : 'NO'}`);
        
        // Check current activity data
        const activityData = await pool.query(`
          SELECT 
            today_date,
            today_active_seconds,
            today_inactive_seconds,
            updated_at
          FROM activity_data 
          WHERE user_id = 2 AND today_date = '${todayDate}'
        `);
        
        if (activityData.rows.length > 0) {
          const row = activityData.rows[0];
          console.log(`\n📊 Current activity data:`);
          console.log(`  Date: ${row.today_date}`);
          console.log(`  Active: ${row.today_active_seconds}s (${(row.today_active_seconds/3600).toFixed(2)} hours)`);
          console.log(`  Inactive: ${row.today_inactive_seconds}s (${(row.today_inactive_seconds/3600).toFixed(2)} hours)`);
          console.log(`  Updated: ${row.updated_at}`);
          
          // Check if this should trigger a reset
          const hasSignificantTime = row.today_active_seconds > 3600 || row.today_inactive_seconds > 3600;
          console.log(`\n🔍 Reset conditions:`);
          console.log(`  Near shift start (≤10 min): ${timeDiffMinutes <= 10 ? 'YES' : 'NO'}`);
          console.log(`  Past shift start with accumulated time (≤1 hour): ${timeDiffMinutes <= 60 && hasSignificantTime ? 'YES' : 'NO'}`);
          console.log(`  Should reset: ${(timeDiffMinutes <= 10) || (timeDiffMinutes <= 60 && hasSignificantTime) ? 'YES' : 'NO'}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging shift timing:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the debug
debugShiftTiming();
