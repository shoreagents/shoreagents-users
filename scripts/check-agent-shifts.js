const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkAgentShifts() {
  try {
    console.log('🔍 Checking Agent Shift Times:\n');
    
    const result = await pool.query(`
      SELECT 
        u.id, 
        u.email, 
        ji.shift_time 
      FROM users u 
      JOIN job_info ji ON (ji.agent_user_id = u.id OR ji.internal_user_id = u.id) 
      WHERE u.user_type = 'Agent' 
      ORDER BY u.id
    `);
    
    result.rows.forEach(row => {
      console.log(`Agent ${row.id} (${row.email}): ${row.shift_time}`);
    });
    
    console.log('\n📋 Current calculate_break_windows logic should handle:');
    console.log('   • 6:00 AM - 3:00 PM shift');
    console.log('   • 7:00 AM - 4:00 PM shift');
    console.log('   • Any other shift times dynamically');
    
    console.log('\n🧪 Testing break windows for different shifts:');
    
    // Test for each agent
    for (const agent of result.rows) {
      console.log(`\n👤 ${agent.email} (${agent.shift_time}):`);
      
      const breakWindowsResult = await pool.query(`
        SELECT * FROM calculate_break_windows($1) ORDER BY start_time
      `, [agent.id]);
      
      breakWindowsResult.rows.forEach(window => {
        const startTime = window.start_time;
        const endTime = window.end_time;
        
        // Convert to 12-hour format for display
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        
        let startAmPm = startHour >= 12 ? 'PM' : 'AM';
        let endAmPm = endHour >= 12 ? 'PM' : 'AM';
        
        let displayStartHour = startHour > 12 ? startHour - 12 : (startHour === 0 ? 12 : startHour);
        let displayEndHour = endHour > 12 ? endHour - 12 : (endHour === 0 ? 12 : endHour);
        
        console.log(`   ${window.break_type}: ${displayStartHour}:${startTime.split(':')[1]} ${startAmPm} - ${displayEndHour}:${endTime.split(':')[1]} ${endAmPm}`);
      });
    }
    
    console.log('\n📝 Notes:');
    console.log('   • Break windows should be calculated based on shift start/end times');
    console.log('   • Morning break: typically 2-3 hours after shift starts');
    console.log('   • Lunch break: typically mid-shift with longer window');
    console.log('   • Afternoon break: typically 1-2 hours before shift ends');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAgentShifts();
