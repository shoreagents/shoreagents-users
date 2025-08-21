const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugBreakMissedStepByStep() {
  try {
    console.log('🔍 Debugging is_break_missed step by step for User 4 at 12:30 AM...\n');
    
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
    
    // Test the function at 12:30 AM
    console.log('\n2️⃣ Testing is_break_missed at 12:30 AM:');
    const test1230am = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 30 minutes')::timestamp) as missed_at_1230am
    `);
    
    console.log(`   • Result: ${test1230am.rows[0].missed_at_1230am}`);
    
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
    
    // Test at 12:30 AM (00:30)
    const testTime = '00:30';
    console.log(`   • Test time: ${testTime}`);
    
    // Check if 12:30 AM is within the break window
    const testTimeMinutes = 0 * 60 + 30; // 30 minutes
    const breakStartMinutes = breakStartHour * 60 + parseInt(startMinute);
    const breakEndMinutes = breakEndHour * 60 + parseInt(startMinute);
    
    console.log(`   • Test time in minutes: ${testTimeMinutes}`);
    console.log(`   • Break start in minutes: ${breakStartMinutes}`);
    console.log(`   • Break end in minutes: ${breakEndMinutes}`);
    
    // Check if we're within the break window
    if (testTimeMinutes >= breakStartMinutes && testTimeMinutes < breakEndMinutes) {
      console.log(`   • ✅ 12:30 AM is WITHIN break window`);
      
      // Calculate minutes since break start
      const minutesSinceStart = testTimeMinutes - breakStartMinutes;
      console.log(`   • Minutes since break start: ${minutesSinceStart}`);
      
      if (minutesSinceStart >= 30) {
        console.log(`   • ✅ It's been at least 30 minutes since break start`);
        
        // Check if we're too close to break end
        const minutesUntilEnd = breakEndMinutes - testTimeMinutes;
        console.log(`   • Minutes until break end: ${minutesUntilEnd}`);
        
        if (minutesUntilEnd >= 15) {
          console.log(`   • ✅ Not too close to break end`);
          
          // Check if it's a 30-minute interval
          if (minutesSinceStart % 30 === 0) {
            console.log(`   • ✅ It's a 30-minute interval - should return TRUE`);
          } else {
            console.log(`   • ❌ Not a 30-minute interval - should return FALSE`);
          }
        } else {
          console.log(`   • ❌ Too close to break end - should return FALSE`);
        }
      } else {
        console.log(`   • ❌ Not enough time since break start - should return FALSE`);
      }
    } else {
      console.log(`   • ❌ 12:30 AM is OUTSIDE break window`);
    }
    
    // Test the actual function with more detailed output
    console.log('\n4️⃣ Detailed function test at various times:');
    const detailedTest = await pool.query(`
      SELECT 
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '22 hours')::timestamp) as missed_at_10pm,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '23 hours 45 minutes')::timestamp) as missed_at_1145pm,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours')::timestamp) as missed_at_12am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 15 minutes')::timestamp) as missed_at_1215am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 30 minutes')::timestamp) as missed_at_1230am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '0 hours 45 minutes')::timestamp) as missed_at_1245am,
        is_break_missed(4, 'NightFirst'::break_type_enum, 
          (CURRENT_DATE + INTERVAL '1 hour')::timestamp) as missed_at_1am
    `);
    
    console.log(`   • 10:00 PM: ${detailedTest.rows[0].missed_at_10pm}`);
    console.log(`   • 11:45 PM: ${detailedTest.rows[0].missed_at_1145pm}`);
    console.log(`   • 12:00 AM: ${detailedTest.rows[0].missed_at_12am}`);
    console.log(`   • 12:15 AM: ${detailedTest.rows[0].missed_at_1215am}`);
    console.log(`   • 12:30 AM: ${detailedTest.rows[0].missed_at_1230am}`);
    console.log(`   • 12:45 AM: ${detailedTest.rows[0].missed_at_1245am}`);
    console.log(`   • 1:00 AM: ${detailedTest.rows[0].missed_at_1am}`);
    
  } catch (error) {
    console.error('❌ Error debugging:', error.message);
  } finally {
    await pool.end();
  }
}

debugBreakMissedStepByStep();
