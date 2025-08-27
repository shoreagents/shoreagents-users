const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugPrecreateStepByStep() {
  console.log('🔍 Debugging Precreate Function Step by Step\n');
  
  try {
    // Step 1: Check if the function exists
    console.log('📋 Step 1: Checking if function exists...');
    const functionCheck = await pool.query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name = 'precreate_next_day_activity_rows'
    `);
    
    if (functionCheck.rows.length === 0) {
      console.log('❌ Function does not exist!');
      return;
    }
    console.log('✅ Function exists:', functionCheck.rows[0]);
    
    // Step 2: Check users table
    console.log('\n📋 Step 2: Checking users table...');
    const usersCheck = await pool.query(`
      SELECT id, email, user_type 
      FROM users 
      WHERE user_type = 'Agent'
      LIMIT 5
    `);
    
    console.log(`📊 Found ${usersCheck.rows.length} agents:`);
    usersCheck.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ID: ${user.id}, Email: ${user.email}, Type: ${user.user_type}`);
    });
    
    // Step 3: Check agents table
    console.log('\n📋 Step 3: Checking agents table...');
    const agentsCheck = await pool.query(`
      SELECT user_id 
      FROM agents 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${agentsCheck.rows.length} agent records:`);
    agentsCheck.rows.forEach((agent, index) => {
      console.log(`   ${index + 1}. User ID: ${agent.user_id}, Team ID: ${agent.team_id}`);
    });
    
    // Step 4: Check job_info table
    console.log('\n📋 Step 4: Checking job_info table...');
    const jobInfoCheck = await pool.query(`
      SELECT agent_user_id, shift_time 
      FROM job_info 
      LIMIT 5
    `);
    
    console.log(`📊 Found ${jobInfoCheck.rows.length} job info records:`);
    jobInfoCheck.rows.forEach((job, index) => {
      console.log(`   ${index + 1}. Agent User ID: ${job.agent_user_id}, Shift: ${job.shift_time}`);
    });
    
    // Step 5: Check the JOIN query that the function uses
    console.log('\n📋 Step 5: Testing the JOIN query from the function...');
    const joinCheck = await pool.query(`
      SELECT u.id AS user_id, ji.shift_time
      FROM users u
      JOIN agents a ON a.user_id = u.id
      LEFT JOIN job_info ji ON ji.agent_user_id = u.id
      WHERE u.user_type = 'Agent'
    `);
    
    console.log(`📊 JOIN query result: ${joinCheck.rows.length} records:`);
    joinCheck.rows.forEach((record, index) => {
      console.log(`   ${index + 1}. User ID: ${record.user_id}, Shift Time: ${record.shift_time || 'NULL'}`);
    });
    
    // Step 6: Check current time vs shift end time for each user
    console.log('\n📋 Step 6: Checking shift end times...');
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    console.log(`⏰ Current time: ${now.toLocaleTimeString()} (${currentMinutes} minutes since midnight)`);
    
    for (const record of joinCheck.rows) {
      if (record.shift_time) {
        // Parse shift time like "6:00 AM - 1:23 PM"
        const timeMatch = record.shift_time.match(/(\d{1,2}:\d{2}\s*(AM|PM)).*-\s*(\d{1,2}:\d{2}\s*(AM|PM))/i);
        if (timeMatch) {
          const endTimeStr = timeMatch[3];
          const endTimeMatch = endTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (endTimeMatch) {
            let endHour = parseInt(endTimeMatch[1]);
            const endMinute = parseInt(endTimeMatch[2]);
            const endPeriod = endTimeMatch[3].toUpperCase();
            
            if (endPeriod === 'PM' && endHour !== 12) {
              endHour += 12;
            } else if (endPeriod === 'AM' && endHour === 12) {
              endHour = 0;
            }
            
            const endMinutes = endHour * 60 + endMinute;
            const shiftEnded = currentMinutes >= endMinutes;
            
            console.log(`   User ${record.user_id}: Shift end: ${endTimeStr} (${endMinutes} min), Ended: ${shiftEnded ? 'YES' : 'NO'}`);
          }
        }
      }
    }
    
    // Step 7: Check if tomorrow's rows already exist
    console.log('\n📋 Step 7: Checking if tomorrow\'s rows exist...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    for (const record of joinCheck.rows) {
      const tomorrowCheck = await pool.query(`
        SELECT id FROM activity_data 
        WHERE user_id = $1 AND today_date = $2
      `, [record.user_id, tomorrowDate]);
      
      if (tomorrowCheck.rows.length > 0) {
        console.log(`   User ${record.user_id}: Row for ${tomorrowDate} already exists (ID: ${tomorrowCheck.rows[0].id})`);
      } else {
        console.log(`   User ${record.user_id}: No row for ${tomorrowDate} - should be created`);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await pool.end();
  }
}

debugPrecreateStepByStep();
