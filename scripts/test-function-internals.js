const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFunctionInternals() {
  console.log('🧪 Testing Function Internal Logic\n');
  
  try {
    // Test the exact logic from the function
    const shiftTime = "6:00 AM - 1:36 PM";
    console.log(`📋 Testing shift time: "${shiftTime}"`);
    
    // Step 1: Parse the shift time
    const timeMatch = shiftTime.match(/(\d{1,2}:\d{2}\s*(AM|PM)).*-\s*(\d{1,2}:\d{2}\s*(AM|PM))/i);
    if (timeMatch) {
      console.log('✅ Regex match successful');
      console.log(`   Start time: ${timeMatch[1]}`);
      console.log(`   End time: ${timeMatch[3]}`);
      
      const endTimeStr = timeMatch[3];
      const endTimeMatch = endTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      
      if (endTimeMatch) {
        console.log('✅ End time parsing successful');
        let endHour = parseInt(endTimeMatch[1]);
        const endMinute = parseInt(endTimeMatch[2]);
        const endPeriod = endTimeMatch[3].toUpperCase();
        
        console.log(`   Raw hour: ${endTimeMatch[1]}, minute: ${endTimeMatch[2]}, period: ${endPeriod}`);
        
        if (endPeriod === 'PM' && endHour !== 12) {
          endHour += 12;
        } else if (endPeriod === 'AM' && endHour === 12) {
          endHour = 0;
        }
        
        const endMinutes = endHour * 60 + endMinute;
        console.log(`   Converted: ${endHour}:${endMinute} ${endPeriod} = ${endMinutes} minutes`);
        
        // Test current time
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        console.log(`   Current time: ${now.toLocaleTimeString()} = ${currentMinutes} minutes`);
        
        const shiftEnded = currentMinutes >= endMinutes;
        console.log(`   Shift ended: ${shiftEnded ? 'YES' : 'NO'}`);
        
        if (shiftEnded) {
          console.log('✅ Shift has ended - should create new row');
        } else {
          console.log('❌ Shift has not ended yet');
        }
      } else {
        console.log('❌ End time parsing failed');
      }
    } else {
      console.log('❌ Regex match failed');
    }
    
    // Step 2: Test the actual function with debug output
    console.log('\n📋 Step 2: Testing actual function...');
    
    // First, let's see what the function returns
    const result = await pool.query(`
      SELECT precreate_next_day_activity_rows() AS created
    `);
    
    const created = result.rows[0]?.created || 0;
    console.log(`📊 Function returned: ${created} rows created`);
    
    // Step 3: Check if any rows were actually created
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`\n📋 Step 3: Checking for rows created on ${tomorrowDate}...`);
    
    const checkResult = await pool.query(`
      SELECT id, user_id, today_date, created_at
      FROM activity_data 
      WHERE today_date = $1
      ORDER BY created_at DESC
    `, [tomorrowDate]);
    
    if (checkResult.rows.length === 0) {
      console.log('❌ No rows found for tomorrow - function failed to create them');
    } else {
      console.log(`✅ Found ${checkResult.rows.length} rows for tomorrow:`);
      checkResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}, User: ${row.user_id}, Created: ${row.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testFunctionInternals();
