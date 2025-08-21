const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAgentShifts() {
  console.log('🔍 Checking Agent Shift Configuration\n');
  
  try {
    // Check shift configuration for agents
    const shiftResult = await pool.query(`
      SELECT 
        u.id,
        u.email,
        ji.shift_time,
        ji.shift_period
      FROM users u
      LEFT JOIN job_info ji ON ji.agent_user_id = u.id
      WHERE u.user_type = 'Agent' AND u.id IN (2, 4)
      ORDER BY u.id
    `);
    
    console.log('📋 Agent Shift Configuration:');
    if (shiftResult.rows.length > 0) {
      shiftResult.rows.forEach(row => {
        console.log(`   • User ${row.id} (${row.email}):`);
        console.log(`     - Shift Time: ${row.shift_time || 'Not configured'}`);
        console.log(`     - Shift Period: ${row.shift_period || 'Not specified'}`);
        
        if (row.shift_time) {
          // Parse the shift time to understand the structure
          const shiftMatch = row.shift_time.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
          if (shiftMatch) {
            const startTime = shiftMatch[1].trim();
            const endTime = shiftMatch[2].trim();
            console.log(`     - Start: ${startTime}`);
            console.log(`     - End: ${endTime}`);
            
            // Determine if it's a night shift (crosses midnight)
            const startHour = parseInt(startTime.split(':')[0]);
            const endHour = parseInt(endTime.split(':')[0]);
            const startAMPM = startTime.includes('PM') ? 'PM' : 'AM';
            const endAMPM = endTime.includes('PM') ? 'PM' : 'AM';
            
            let isNightShift = false;
            if (startAMPM === 'PM' && endAMPM === 'AM') {
              isNightShift = true;
            } else if (startAMPM === 'PM' && endAMPM === 'PM' && startHour > endHour) {
              isNightShift = true;
            } else if (startAMPM === 'AM' && endAMPM === 'AM' && startHour > endHour) {
              isNightShift = true;
            }
            
            console.log(`     - Type: ${isNightShift ? 'Night Shift (crosses midnight)' : 'Day Shift'}`);
          }
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No agents found');
    }
    
    // Check if there are other shift-related tables
    console.log('🔍 Checking for other shift-related data...');
    
    try {
      const agentsResult = await pool.query(`
        SELECT 
          user_id,
          shift_time,
          shift_period
        FROM agents
        WHERE user_id IN (2, 4)
        ORDER BY user_id
      `);
      
      if (agentsResult.rows.length > 0) {
        console.log('   📋 Agents table data:');
        agentsResult.rows.forEach(row => {
          console.log(`     • User ${row.user_id}: ${row.shift_time || 'No shift'} (${row.shift_period || 'No period'})`);
        });
      } else {
        console.log('   • No data in agents table for these users');
      }
    } catch (error) {
      console.log(`   • Agents table query failed: ${error.message}`);
    }
    
    // Check current time and what would be appropriate
    console.log('\n🕐 Current Time Analysis:');
    const timeResult = await pool.query(`
      SELECT 
        NOW() AT TIME ZONE 'Asia/Manila' as manila_now,
        EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_hour,
        EXTRACT(MINUTE FROM NOW() AT TIME ZONE 'Asia/Manila') as manila_minute
    `);
    
    const currentTime = timeResult.rows[0];
    console.log(`   • Current Manila time: ${currentTime.manila_now}`);
    console.log(`   • Current hour: ${currentTime.manila_hour}:${currentTime.manila_minute}`);
    
    // Determine what shift this would be for
    const currentHour = currentTime.manila_hour;
    if (currentHour >= 6 && currentHour < 18) {
      console.log('   • Current time suggests: Day shift hours (6 AM - 6 PM)');
    } else {
      console.log('   • Current time suggests: Night shift hours (6 PM - 6 AM)');
    }
    
    console.log('\n💡 Recommendation:');
    console.log('   • The system should use ACTUAL shift times from job_info table');
    console.log('   • Not hardcoded 6 AM - 6 PM logic');
    console.log('   • Support shifts like "10:00 PM - 7:00 AM" for night agents');
    console.log('   • Support shifts like "6:00 AM - 3:00 PM" for day agents');
    
  } catch (error) {
    console.error('❌ Error checking agent shifts:', error.message);
  } finally {
    await pool.end();
  }
}

checkAgentShifts();
