const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugIsBreakMissed() {
  try {
    console.log('🔍 Debugging is_break_missed function for User 4...\n');
    
    // Get User 4's shift information
    console.log('1️⃣ User 4 shift information:');
    const shiftInfo = await pool.query(`
      SELECT * FROM get_agent_shift_info(4) LIMIT 1;
    `);
    
    if (shiftInfo.rows.length > 0) {
      console.log(`   • Shift time: ${shiftInfo.rows[0].shift_time}`);
      console.log(`   • Shift period: ${shiftInfo.rows[0].shift_period}`);
    } else {
      console.log('   ❌ No shift info found');
      return;
    }
    
    // Test the function step by step
    console.log('\n2️⃣ Testing is_break_missed at 10:00 PM:');
    const test10pm = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '22 hours')::timestamp) as missed_at_10pm
    `);
    
    console.log(`   • Result: ${test10pm.rows[0].missed_at_10pm}`);
    
    // Let's manually calculate what the function should be doing
    console.log('\n3️⃣ Manual calculation for User 4 NightFirst break:');
    
    // Parse shift time manually
    const shiftTime = shiftInfo.rows[0].shift_time; // e.g., "10:00 PM - 7:00 AM"
    console.log(`   • Raw shift time: ${shiftTime}`);
    
    // Parse start time
    const startPart = shiftTime.split(' - ')[0]; // "10:00 PM"
    const startHour = parseInt(startPart.split(':')[0]);
    const startMinute = startPart.split(':')[1].split(' ')[0];
    const startAMPM = startPart.split(' ')[1];
    
    let startHour24 = startHour;
    if (startAMPM === 'PM' && startHour !== 12) startHour24 += 12;
    if (startAMPM === 'AM' && startHour === 12) startHour24 = 0;
    
    console.log(`   • Parsed start: ${startHour}:${startMinute} ${startAMPM} -> ${startHour24}:${startMinute}`);
    
    // Calculate break start time (2 hours after shift start)
    const breakStartHour = (startHour24 + 2) % 24;
    const breakStartTime = `${breakStartHour.toString().padStart(2, '0')}:${startMinute}`;
    console.log(`   • Break start time: ${breakStartTime} (2 hours after shift start)`);
    
    // Calculate break end time (3 hours after shift start)
    const breakEndHour = (startHour24 + 3) % 24;
    const breakEndTime = `${breakEndHour.toString().padStart(2, '0')}:${startMinute}`;
    console.log(`   • Break end time: ${breakEndTime} (3 hours after shift start)`);
    
    // Test at 10:00 PM (22:00)
    const testTime = '22:00';
    console.log(`   • Test time: ${testTime}`);
    
    // Check if 10:00 PM is before break start
    const testTimeMinutes = 22 * 60;
    const breakStartMinutes = breakStartHour * 60 + parseInt(startMinute);
    const breakEndMinutes = breakEndHour * 60 + parseInt(startMinute);
    
    console.log(`   • Test time in minutes: ${testTimeMinutes}`);
    console.log(`   • Break start in minutes: ${breakStartMinutes}`);
    console.log(`   • Break end in minutes: ${breakEndMinutes}`);
    
    if (testTimeMinutes < breakStartMinutes) {
      console.log(`   • ✅ 10:00 PM is BEFORE break start - should return FALSE`);
    } else if (testTimeMinutes > breakEndMinutes) {
      console.log(`   • ❌ 10:00 PM is AFTER break end - should return TRUE (missed)`);
    } else {
      console.log(`   • ⚠️  10:00 PM is DURING break window - should return FALSE`);
    }
    
    // Test the actual function with more detailed output
    console.log('\n4️⃣ Detailed function test:');
    const detailedTest = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '22 hours')::timestamp) as missed_at_10pm,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours')::timestamp) as missed_at_12am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '1 hours')::timestamp) as missed_at_1am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '2 hours')::timestamp) as missed_at_2am
    `);
    
    console.log(`   • 10:00 PM: ${detailedTest.rows[0].missed_at_10pm}`);
    console.log(`   • 12:00 AM: ${detailedTest.rows[0].missed_at_12am}`);
    console.log(`   • 1:00 AM: ${detailedTest.rows[0].missed_at_1am}`);
    console.log(`   • 2:00 AM: ${detailedTest.rows[0].missed_at_2am}`);
    
  } catch (error) {
    console.error('❌ Error debugging:', error.message);
  } finally {
    await pool.end();
  }
}

debugIsBreakMissed();
