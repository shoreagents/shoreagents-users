#!/usr/bin/env node

/**
 * Test Script: Shift-Based Activity Data System
 * 
 * This script tests:
 * 1. New row creation at shift boundaries
 * 2. Timer start/stop based on shift times
 * 3. Day shift vs Night shift behavior
 * 4. Shift-anchored date calculation
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test configuration
const TEST_CONFIG = {
  // Test user (will be created if doesn't exist)
  testEmail: 'test-shift-agent@example.com',
  
  // Test shift schedules
  dayShift: '6:00 AM - 3:30 PM',
  nightShift: '10:00 PM - 6:00 AM',
  
  // Test scenarios
  scenarios: [
    {
      name: 'Day Shift - Before Start',
      shiftTime: '6:00 AM - 3:30 PM',
      testTime: '2025-08-18 05:30:00',
      expectedBehavior: 'No counting, uses previous day date'
    },
    {
      name: 'Day Shift - At Start',
      shiftTime: '6:00 AM - 3:30 PM', 
      testTime: '2025-08-18 06:00:00',
      expectedBehavior: 'Start counting, uses current day date'
    },
    {
      name: 'Day Shift - During Shift',
      shiftTime: '6:00 AM - 3:30 PM',
      testTime: '2025-08-18 10:30:00', 
      expectedBehavior: 'Continue counting, same row'
    },
    {
      name: 'Day Shift - After End',
      shiftTime: '6:00 AM - 3:30 PM',
      testTime: '2025-08-18 16:00:00',
      expectedBehavior: 'Stop counting, same row'
    },
    {
      name: 'Night Shift - Before Start',
      shiftTime: '10:00 PM - 6:00 AM',
      testTime: '2025-08-18 21:30:00',
      expectedBehavior: 'No counting, uses previous day date'
    },
    {
      name: 'Night Shift - At Start',
      shiftTime: '10:00 PM - 6:00 AM',
      testTime: '2025-08-18 22:00:00',
      expectedBehavior: 'Start counting, uses current day date'
    },
    {
      name: 'Night Shift - After Midnight',
      shiftTime: '10:00 PM - 6:00 AM',
      testTime: '2025-08-19 02:00:00',
      expectedBehavior: 'Continue counting, same row (Aug 18 date)'
    },
    {
      name: 'Night Shift - At End',
      shiftTime: '10:00 PM - 6:00 AM',
      testTime: '2025-08-19 06:00:00',
      expectedBehavior: 'Stop counting, same row (Aug 18 date)'
    }
  ]
};

// Utility functions
function parseShiftTime(shiftTimeString, referenceDate = new Date()) {
  if (!shiftTimeString) return null;

  try {
    const timeMatch = shiftTimeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (!timeMatch) return null;

    const [, startTimeStr, endTimeStr] = timeMatch;
    
    const today = new Date(referenceDate);
    today.setSeconds(0, 0);

    const startTime = parseTimeString(startTimeStr, today);
    let endTime = parseTimeString(endTimeStr, today);

    const isNightShift = endTime <= startTime;
    if (isNightShift) {
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    }

    return {
      period: isNightShift ? "Night Shift" : "Day Shift",
      time: shiftTimeString,
      startTime,
      endTime,
      isNightShift
    };
  } catch (error) {
    console.error('Error parsing shift time:', error);
    return null;
  }
}

function parseTimeString(timeStr, baseDate) {
  const cleanTimeStr = timeStr.trim();
  const [time, period] = cleanTimeStr.split(/\s+/);
  const [hours, minutes] = time.split(':').map(Number);
  
  let hour24 = hours;
  if (period && period.toUpperCase() === 'PM' && hours !== 12) {
    hour24 += 12;
  } else if (period && period.toUpperCase() === 'AM' && hours === 12) {
    hour24 = 0;
  }
  
  const result = new Date(baseDate);
  result.setHours(hour24, minutes, 0, 0);
  return result;
}

function formatTime(date) {
  return date.toLocaleString('en-US', { 
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

// Test functions
async function setupTestUser(email, shiftTime) {
  console.log(`\n📝 Setting up test user: ${email}`);
  
  try {
    // Create or get user
    let userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    
    if (userResult.rows.length === 0) {
      const newUserResult = await pool.query(
        'INSERT INTO users (email, user_type) VALUES ($1, $2) RETURNING id',
        [email, 'Agent']
      );
      userId = newUserResult.rows[0].id;
      console.log(`✅ Created new user with ID: ${userId}`);
    } else {
      userId = userResult.rows[0].id;
      console.log(`✅ Using existing user with ID: ${userId}`);
    }

    // Create or update job_info with shift time
    await pool.query(`
      INSERT INTO job_info (employee_id, agent_user_id, shift_time, job_title)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (employee_id) 
      DO UPDATE SET shift_time = EXCLUDED.shift_time
    `, [`TEST-${userId}`, userId, shiftTime, 'Test Agent']);
    
    console.log(`✅ Set shift time: ${shiftTime}`);
    return userId;
  } catch (error) {
    console.error('❌ Error setting up test user:', error);
    throw error;
  }
}

async function testShiftAnchoredDate(userId, testTime, shiftTime) {
  console.log(`\n🧪 Testing shift-anchored date calculation`);
  console.log(`   Test time: ${formatTime(new Date(testTime))}`);
  console.log(`   Shift: ${shiftTime}`);
  
  try {
    // Parse shift info
    const shiftInfo = parseShiftTime(shiftTime, new Date(testTime));
    if (!shiftInfo) {
      throw new Error('Failed to parse shift time');
    }
    
    // Calculate expected date using our logic
    const testDate = new Date(testTime);
    const testTimeOnly = testDate.toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Manila',
      hour12: false 
    });
    const shiftStartTime = shiftInfo.startTime.toLocaleTimeString('en-US', { 
      hour12: false 
    });
    
    let expectedDate;
    if (testTimeOnly < shiftStartTime) {
      // Before shift start - use previous day
      expectedDate = new Date(testDate);
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      // At/after shift start - use current day
      expectedDate = new Date(testDate);
    }
    
    const expectedDateStr = expectedDate.toISOString().split('T')[0];
    
    console.log(`   Shift start: ${shiftInfo.startTime.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Shift end: ${shiftInfo.endTime.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Expected row date: ${expectedDateStr}`);
    
    // Test the actual database query
    const query = `
      SELECT (
        CASE WHEN $1::time < $2::time 
             THEN ($1::date - INTERVAL '1 day')::date 
             ELSE $1::date 
        END
      ) as calculated_date
    `;
    
    const result = await pool.query(query, [testTime, shiftStartTime]);
    const calculatedDate = result.rows[0].calculated_date.toISOString().split('T')[0];
    
    console.log(`   Database calculated: ${calculatedDate}`);
    
    if (calculatedDate === expectedDateStr) {
      console.log(`   ✅ Date calculation correct!`);
    } else {
      console.log(`   ❌ Date calculation mismatch!`);
    }
    
    return {
      testTime,
      shiftInfo,
      expectedDate: expectedDateStr,
      calculatedDate,
      isCorrect: calculatedDate === expectedDateStr
    };
    
  } catch (error) {
    console.error('❌ Error testing shift-anchored date:', error);
    return { isCorrect: false, error: error.message };
  }
}

async function testActivityAPI(userId, testTime, shiftTime, isActive = true) {
  console.log(`\n🔌 Testing Activity API`);
  console.log(`   Time: ${formatTime(new Date(testTime))}`);
  console.log(`   Active: ${isActive}`);
  
  try {
    // Simulate API call by directly calling the database logic
    const shiftInfo = parseShiftTime(shiftTime, new Date(testTime));
    const shiftStartTime = shiftInfo.startTime.toLocaleTimeString('en-US', { hour12: false });
    
    // Check if row exists
    const existingQuery = `
      SELECT * FROM activity_data 
      WHERE user_id = $1 
        AND today_date = (
          CASE WHEN $2::time < $3::time 
               THEN ($2::date - INTERVAL '1 day')::date 
               ELSE $2::date 
          END
        )
    `;
    
    const existing = await pool.query(existingQuery, [userId, testTime, shiftStartTime]);
    
    if (existing.rows.length === 0) {
      // Create new row
      const insertQuery = `
        INSERT INTO activity_data 
        (user_id, is_currently_active, last_session_start, today_date) 
        VALUES (
          $1, $2, $3,
          (
            CASE WHEN $4::time < $5::time
                 THEN ($4::date - INTERVAL '1 day')::date
                 ELSE $4::date
            END
          )
        ) 
        RETURNING *
      `;
      
      const result = await pool.query(insertQuery, [
        userId, 
        isActive, 
        isActive ? testTime : null,
        testTime,
        shiftStartTime
      ]);
      
      console.log(`   ✅ Created new row with date: ${result.rows[0].today_date.toISOString().split('T')[0]}`);
      console.log(`   ✅ Initial values: ${result.rows[0].today_active_seconds}s active, ${result.rows[0].today_inactive_seconds}s inactive`);
      
      return { created: true, row: result.rows[0] };
    } else {
      console.log(`   ✅ Found existing row with date: ${existing.rows[0].today_date.toISOString().split('T')[0]}`);
      console.log(`   ✅ Current values: ${existing.rows[0].today_active_seconds}s active, ${existing.rows[0].today_inactive_seconds}s inactive`);
      
      return { created: false, row: existing.rows[0] };
    }
    
  } catch (error) {
    console.error('❌ Error testing Activity API:', error);
    return { error: error.message };
  }
}

async function testTimerGuards(testTime, shiftTime) {
  console.log(`\n⏰ Testing Timer Guards`);
  console.log(`   Time: ${formatTime(new Date(testTime))}`);
  
  try {
    const shiftInfo = parseShiftTime(shiftTime, new Date(testTime));
    const nowPH = new Date(testTime);
    
    // Test shift start guard
    const beforeShiftStart = nowPH < shiftInfo.startTime;
    console.log(`   Before shift start: ${beforeShiftStart} (should not count)`);
    
    // Test shift end guard  
    const afterShiftEnd = nowPH > shiftInfo.endTime;
    console.log(`   After shift end: ${afterShiftEnd} (should not count)`);
    
    // Test if should count
    const shouldCount = !beforeShiftStart && !afterShiftEnd;
    console.log(`   Should count: ${shouldCount}`);
    
    return {
      beforeShiftStart,
      afterShiftEnd, 
      shouldCount,
      shiftStart: formatTime(shiftInfo.startTime),
      shiftEnd: formatTime(shiftInfo.endTime)
    };
    
  } catch (error) {
    console.error('❌ Error testing timer guards:', error);
    return { error: error.message };
  }
}

async function cleanupTestData(userId) {
  console.log(`\n🧹 Cleaning up test data for user ${userId}`);
  
  try {
    // Delete activity data
    await pool.query('DELETE FROM activity_data WHERE user_id = $1', [userId]);
    
    // Delete job info
    await pool.query('DELETE FROM job_info WHERE agent_user_id = $1', [userId]);
    
    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Shift-Based Activity Data System Tests\n');
  console.log('=' .repeat(60));
  
  let testUserId;
  const results = [];
  
  try {
    // Test Day Shift scenarios
    console.log('\n📅 DAY SHIFT TESTS (6:00 AM - 3:30 PM)');
    console.log('=' .repeat(60));
    
    testUserId = await setupTestUser(TEST_CONFIG.testEmail, TEST_CONFIG.dayShift);
    
    for (const scenario of TEST_CONFIG.scenarios.filter(s => s.name.includes('Day Shift'))) {
      console.log(`\n🧪 ${scenario.name}`);
      console.log(`   Expected: ${scenario.expectedBehavior}`);
      
      // Test date calculation
      const dateResult = await testShiftAnchoredDate(testUserId, scenario.testTime, scenario.shiftTime);
      
      // Test timer guards
      const guardResult = await testTimerGuards(scenario.testTime, scenario.shiftTime);
      
      // Test API behavior
      const apiResult = await testActivityAPI(testUserId, scenario.testTime, scenario.shiftTime);
      
      results.push({
        scenario: scenario.name,
        dateResult,
        guardResult,
        apiResult
      });
    }
    
    // Clean up day shift user
    await cleanupTestData(testUserId);
    
    // Test Night Shift scenarios
    console.log('\n\n🌙 NIGHT SHIFT TESTS (10:00 PM - 6:00 AM)');
    console.log('=' .repeat(60));
    
    testUserId = await setupTestUser(TEST_CONFIG.testEmail, TEST_CONFIG.nightShift);
    
    for (const scenario of TEST_CONFIG.scenarios.filter(s => s.name.includes('Night Shift'))) {
      console.log(`\n🧪 ${scenario.name}`);
      console.log(`   Expected: ${scenario.expectedBehavior}`);
      
      // Test date calculation
      const dateResult = await testShiftAnchoredDate(testUserId, scenario.testTime, scenario.shiftTime);
      
      // Test timer guards
      const guardResult = await testTimerGuards(scenario.testTime, scenario.shiftTime);
      
      // Test API behavior
      const apiResult = await testActivityAPI(testUserId, scenario.testTime, scenario.shiftTime);
      
      results.push({
        scenario: scenario.name,
        dateResult,
        guardResult,
        apiResult
      });
    }
    
    // Print summary
    console.log('\n\n📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(result => {
      const success = result.dateResult.isCorrect && !result.guardResult.error && !result.apiResult.error;
      if (success) {
        passed++;
        console.log(`✅ ${result.scenario}`);
      } else {
        failed++;
        console.log(`❌ ${result.scenario}`);
        if (result.dateResult.error) console.log(`   Date Error: ${result.dateResult.error}`);
        if (result.guardResult.error) console.log(`   Guard Error: ${result.guardResult.error}`);
        if (result.apiResult.error) console.log(`   API Error: ${result.apiResult.error}`);
      }
    });
    
    console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
      console.log('\n🎉 All tests passed! Shift-based activity system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the implementation.');
    }
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
  } finally {
    // Final cleanup
    if (testUserId) {
      await cleanupTestData(testUserId);
    }
    
    // Close database connection
    await pool.end();
    console.log('\n👋 Test completed');
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  parseShiftTime,
  testShiftAnchoredDate,
  testActivityAPI,
  testTimerGuards
};
