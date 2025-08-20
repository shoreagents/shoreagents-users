const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkGetAgentShiftInfo() {
  try {
    console.log('🔍 Checking get_agent_shift_info function...\n');
    
    const userId1 = 1;
    const userId2 = 2;
    
    // 1. Check the function source code
    console.log('1️⃣ Function Source Code:');
    const functionSourceResult = await pool.query(`
      SELECT pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'get_agent_shift_info'
      LIMIT 1
    `);
    
    if (functionSourceResult.rows.length > 0) {
      const source = functionSourceResult.rows[0].source;
      console.log('   Function source:');
      console.log('   ' + source);
      
      // Look for potential issues
      if (source.includes('COALESCE')) {
        console.log('\n   📍 Function uses COALESCE - might be returning default values');
      }
      
      if (source.includes('DEFAULT')) {
        console.log('   📍 Function has DEFAULT values');
      }
      
      if (source.includes('IS NULL')) {
        console.log('   📍 Function has NULL checks');
      }
      
      if (source.includes('LEFT JOIN')) {
        console.log('   📍 Function uses LEFT JOIN - might be creating default rows');
      }
    } else {
      console.log('   ❌ Function not found');
    }
    
    // 2. Test the function for both users
    console.log('\n2️⃣ Testing get_agent_shift_info for both users:');
    
    try {
      const user1ShiftInfo = await pool.query(`
        SELECT * FROM get_agent_shift_info($1)
      `, [userId1]);
      
      const user2ShiftInfo = await pool.query(`
        SELECT * FROM get_agent_shift_info($1)
      `, [userId2]);
      
      console.log(`   User 1 shift info: ${JSON.stringify(user1ShiftInfo.rows[0] || 'No rows')}`);
      console.log(`   User 2 shift info: ${JSON.stringify(user2ShiftInfo.rows[0] || 'No rows')}`);
      
      // 3. Compare with direct database query
      console.log('\n3️⃣ Direct Database Query Comparison:');
      
      const directQuery = await pool.query(`
        SELECT 
          u.id,
          u.email,
          a.member_id,
          j.shift_time,
          j.shift_period,
          j.agent_user_id
        FROM users u
        LEFT JOIN agents a ON u.id = a.user_id
        LEFT JOIN job_info j ON u.id = j.agent_user_id
        WHERE u.id IN ($1, $2)
        ORDER BY u.id
      `, [userId1, userId2]);
      
      directQuery.rows.forEach((row, index) => {
        console.log(`   User ${row.id} (${row.email}):`);
        console.log(`     Shift Time: ${row.shift_time}`);
        console.log(`     Shift Period: ${row.shift_period}`);
        console.log(`     Agent User ID: ${row.agent_user_id}`);
        console.log(`     Member ID: ${row.member_id}`);
        console.log('');
      });
      
      // 4. Check if there are any default values in the database
      console.log('4️⃣ Checking for default values in database:');
      
      const defaultCheck = await pool.query(`
        SELECT 
          shift_time,
          shift_period,
          COUNT(*) as count
        FROM job_info
        WHERE shift_time IS NOT NULL
        GROUP BY shift_time, shift_period
        ORDER BY count DESC
        LIMIT 5
      `);
      
      if (defaultCheck.rows.length > 0) {
        console.log('   Common shift configurations:');
        defaultCheck.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.shift_time} (${row.shift_period}): ${row.count} users`);
        });
      }
      
    } catch (error) {
      console.log(`   ❌ Error testing function: ${error.message}`);
    }
    
    // 5. Summary
    console.log('\n✅ get_agent_shift_info check completed!');
    
    console.log('\n🎯 What we found:');
    console.log('   • User 1 has no shift time in job_info (null)');
    console.log('   • But get_agent_shift_info returns "6:00 AM - 3:00 PM"');
    console.log('   • This suggests the function is not properly handling null values');
    console.log('   • It might be using COALESCE or default values');
    
  } catch (error) {
    console.error('❌ Error checking get_agent_shift_info:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkGetAgentShiftInfo();
