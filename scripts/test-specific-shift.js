#!/usr/bin/env node

/**
 * Manual test script for specific shift scenarios
 * Usage: node scripts/test-specific-shift.js [email] [shift-time] [test-time]
 * 
 * Examples:
 * node scripts/test-specific-shift.js "john@example.com" "6:00 AM - 3:30 PM" "2025-08-18 10:30:00"
 * node scripts/test-specific-shift.js "jane@example.com" "10:00 PM - 6:00 AM" "2025-08-19 02:00:00"
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Get command line arguments
const [,, email, shiftTime, testTime] = process.argv;

if (!email || !shiftTime || !testTime) {
  console.log('❌ Usage: node scripts/test-specific-shift.js [email] [shift-time] [test-time]');
  console.log('\nExamples:');
  console.log('  Day Shift:   node scripts/test-specific-shift.js "john@example.com" "6:00 AM - 3:30 PM" "2025-08-18 10:30:00"');
  console.log('  Night Shift: node scripts/test-specific-shift.js "jane@example.com" "10:00 PM - 6:00 AM" "2025-08-19 02:00:00"');
  process.exit(1);
}

async function testSpecificShift() {
  console.log('🧪 Testing Specific Shift Scenario');
  console.log('=' .repeat(50));
  console.log(`📧 Email: ${email}`);
  console.log(`⏰ Shift: ${shiftTime}`);
  console.log(`🕐 Test Time: ${testTime}`);
  console.log('');

  try {
    // 1. Get or create user
    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    
    if (userResult.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (email, user_type) VALUES ($1, $2) RETURNING id',
        [email, 'Agent']
      );
      userId = newUser.rows[0].id;
      console.log(`✅ Created new user with ID: ${userId}`);
    } else {
      userId = userResult.rows[0].id;
      console.log(`✅ Found existing user with ID: ${userId}`);
    }

    // 2. Set up job_info with shift time
    await pool.query(`
      INSERT INTO job_info (employee_id, agent_user_id, shift_time, job_title)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id) 
      DO UPDATE SET shift_time = EXCLUDED.shift_time
    `, [`TEST-${userId}`, userId, shiftTime, 'Test Agent']);
    console.log(`✅ Updated shift time in job_info`);

    // 3. Parse shift info
    const { parseShiftTime } = require('./test-shift-activity-system');
    const shiftInfo = parseShiftTime(shiftTime, new Date(testTime));
    
    if (!shiftInfo) {
      throw new Error('Failed to parse shift time');
    }

    console.log(`\n📊 Shift Analysis:`);
    console.log(`   Type: ${shiftInfo.period}`);
    console.log(`   Start: ${shiftInfo.startTime.toLocaleString()}`);
    console.log(`   End: ${shiftInfo.endTime.toLocaleString()}`);
    console.log(`   Night Shift: ${shiftInfo.isNightShift}`);

    // 4. Test shift-anchored date calculation
    const testDate = new Date(testTime);
    const shiftStartTime = shiftInfo.startTime.toLocaleTimeString('en-US', { hour12: false });
    
    const dateQuery = `
      SELECT (
        CASE WHEN $1::time < $2::time 
             THEN ($1::date - INTERVAL '1 day')::date 
             ELSE $1::date 
        END
      ) as calculated_date
    `;
    
    const dateResult = await pool.query(dateQuery, [testTime, shiftStartTime]);
    const calculatedDate = dateResult.rows[0].calculated_date.toISOString().split('T')[0];
    
    console.log(`\n📅 Date Calculation:`);
    console.log(`   Test Time: ${testDate.toLocaleString()}`);
    console.log(`   Shift Start: ${shiftStartTime}`);
    console.log(`   Row Date: ${calculatedDate}`);

    // 5. Test timer guards
    const nowPH = new Date(testTime);
    const beforeShiftStart = nowPH < shiftInfo.startTime;
    const afterShiftEnd = nowPH > shiftInfo.endTime;
    const shouldCount = !beforeShiftStart && !afterShiftEnd;

    console.log(`\n⏰ Timer Guards:`);
    console.log(`   Before shift start: ${beforeShiftStart}`);
    console.log(`   After shift end: ${afterShiftEnd}`);
    console.log(`   Should count: ${shouldCount ? '✅ YES' : '❌ NO'}`);

    // 6. Test activity data creation/retrieval
    const activityQuery = `
      SELECT * FROM activity_data 
      WHERE user_id = $1 
        AND today_date = (
          CASE WHEN $2::time < $3::time 
               THEN ($2::date - INTERVAL '1 day')::date 
               ELSE $2::date 
          END
        )
    `;
    
    const activityResult = await pool.query(activityQuery, [userId, testTime, shiftStartTime]);
    
    console.log(`\n💾 Activity Data:`);
    if (activityResult.rows.length === 0) {
      console.log(`   Status: No row exists for this shift period`);
      console.log(`   Action: Would create new row with 0 seconds`);
    } else {
      const row = activityResult.rows[0];
      console.log(`   Status: Row exists`);
      console.log(`   Row Date: ${row.today_date.toISOString().split('T')[0]}`);
      console.log(`   Active Seconds: ${row.today_active_seconds || 0}`);
      console.log(`   Inactive Seconds: ${row.today_inactive_seconds || 0}`);
      console.log(`   Currently Active: ${row.is_currently_active}`);
      console.log(`   Last Updated: ${row.updated_at}`);
    }

    // 7. Show what would happen with API call
    console.log(`\n🔌 API Simulation:`);
    if (shouldCount) {
      console.log(`   ✅ Timer would count (within shift hours)`);
      console.log(`   ✅ Database updates would be allowed`);
      console.log(`   ✅ Socket sync would work`);
    } else {
      console.log(`   ❌ Timer would NOT count (outside shift hours)`);
      console.log(`   ❌ Database updates would be blocked`);
      console.log(`   ❌ Socket sync would be blocked`);
    }

    console.log(`\n🎯 Summary:`);
    console.log(`   Shift Type: ${shiftInfo.period}`);
    console.log(`   Row Date: ${calculatedDate}`);
    console.log(`   Timer Active: ${shouldCount ? 'YES' : 'NO'}`);
    console.log(`   Row Exists: ${activityResult.rows.length > 0 ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testSpecificShift();
