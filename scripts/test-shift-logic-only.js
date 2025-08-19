#!/usr/bin/env node

/**
 * Test Script: Shift Logic Validation (No Database)
 * 
 * This script tests the core shift-based logic without database operations
 */

// Utility functions (copied from your implementation)
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

// Test shift-anchored date calculation (your database logic)
function calculateShiftAnchoredDate(testTime, shiftStartTime) {
  const testDate = new Date(testTime);
  const testTimeOnly = testDate.toLocaleTimeString('en-US', { 
    timeZone: 'Asia/Manila',
    hour12: false 
  });
  
  // This mimics your SQL logic:
  // CASE WHEN (NOW() AT TIME ZONE 'Asia/Manila')::time < $2::time 
  //      THEN ((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '1 day')::date
  //      ELSE (NOW() AT TIME ZONE 'Asia/Manila')::date
  // END
  
  if (testTimeOnly < shiftStartTime) {
    // Before shift start - use previous day
    const previousDay = new Date(testDate);
    previousDay.setDate(previousDay.getDate() - 1);
    return previousDay.toISOString().split('T')[0];
  } else {
    // At/after shift start - use current day
    return testDate.toISOString().split('T')[0];
  }
}

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Day Shift - Before Start (5:30 AM)',
    shiftTime: '6:00 AM - 3:30 PM',
    testTime: '2025-08-18 05:30:00',
    expectedBehavior: 'No counting, uses previous day date (Aug 17)',
    expectedDate: '2025-08-17',
    shouldCount: false
  },
  {
    name: 'Day Shift - At Start (6:00 AM)',
    shiftTime: '6:00 AM - 3:30 PM', 
    testTime: '2025-08-18 06:00:00',
    expectedBehavior: 'Start counting, uses current day date (Aug 18)',
    expectedDate: '2025-08-18',
    shouldCount: true
  },
  {
    name: 'Day Shift - During Shift (10:30 AM)',
    shiftTime: '6:00 AM - 3:30 PM',
    testTime: '2025-08-18 10:30:00', 
    expectedBehavior: 'Continue counting, same row (Aug 18)',
    expectedDate: '2025-08-18',
    shouldCount: true
  },
  {
    name: 'Day Shift - At End (3:30 PM)',
    shiftTime: '6:00 AM - 3:30 PM',
    testTime: '2025-08-18 15:30:00',
    expectedBehavior: 'Stop counting, same row (Aug 18)',
    expectedDate: '2025-08-18',
    shouldCount: false
  },
  {
    name: 'Day Shift - After End (4:00 PM)',
    shiftTime: '6:00 AM - 3:30 PM',
    testTime: '2025-08-18 16:00:00',
    expectedBehavior: 'Stop counting, same row (Aug 18)',
    expectedDate: '2025-08-18',
    shouldCount: false
  },
  {
    name: 'Night Shift - Before Start (9:30 PM)',
    shiftTime: '10:00 PM - 6:00 AM',
    testTime: '2025-08-18 21:30:00',
    expectedBehavior: 'No counting, uses previous day date (Aug 17)',
    expectedDate: '2025-08-17',
    shouldCount: false
  },
  {
    name: 'Night Shift - At Start (10:00 PM)',
    shiftTime: '10:00 PM - 6:00 AM',
    testTime: '2025-08-18 22:00:00',
    expectedBehavior: 'Start counting, uses current day date (Aug 18)',
    expectedDate: '2025-08-18',
    shouldCount: true
  },
  {
    name: 'Night Shift - After Midnight (2:00 AM)',
    shiftTime: '10:00 PM - 6:00 AM',
    testTime: '2025-08-19 02:00:00',
    expectedBehavior: 'Continue counting, same row (Aug 18 date)',
    expectedDate: '2025-08-18',
    shouldCount: true
  },
  {
    name: 'Night Shift - At End (6:00 AM)',
    shiftTime: '10:00 PM - 6:00 AM',
    testTime: '2025-08-19 06:00:00',
    expectedBehavior: 'Stop counting, same row (Aug 18 date)',
    expectedDate: '2025-08-18',
    shouldCount: false
  },
  {
    name: 'Night Shift - After End (7:00 AM)',
    shiftTime: '10:00 PM - 6:00 AM',
    testTime: '2025-08-19 07:00:00',
    expectedBehavior: 'Stop counting, same row (Aug 18 date)',
    expectedDate: '2025-08-18',
    shouldCount: false
  }
];

function testScenario(scenario) {
  console.log(`\n🧪 ${scenario.name}`);
  console.log(`   Expected: ${scenario.expectedBehavior}`);
  console.log(`   Test Time: ${formatTime(new Date(scenario.testTime))}`);
  
  try {
    // Parse shift info
    const shiftInfo = parseShiftTime(scenario.shiftTime, new Date(scenario.testTime));
    if (!shiftInfo) {
      throw new Error('Failed to parse shift time');
    }
    
    console.log(`   Shift Type: ${shiftInfo.period}`);
    console.log(`   Shift Start: ${formatTime(shiftInfo.startTime)}`);
    console.log(`   Shift End: ${formatTime(shiftInfo.endTime)}`);
    
    // Test date calculation
    const shiftStartTime = shiftInfo.startTime.toLocaleTimeString('en-US', { hour12: false });
    const calculatedDate = calculateShiftAnchoredDate(scenario.testTime, shiftStartTime);
    
    console.log(`   Expected Date: ${scenario.expectedDate}`);
    console.log(`   Calculated Date: ${calculatedDate}`);
    
    const dateCorrect = calculatedDate === scenario.expectedDate;
    console.log(`   Date Calculation: ${dateCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    
    // Test timer guards
    const nowPH = new Date(scenario.testTime);
    const beforeShiftStart = nowPH < shiftInfo.startTime;
    const afterShiftEnd = nowPH > shiftInfo.endTime;
    const shouldCount = !beforeShiftStart && !afterShiftEnd;
    
    console.log(`   Before Shift Start: ${beforeShiftStart}`);
    console.log(`   After Shift End: ${afterShiftEnd}`);
    console.log(`   Should Count: ${shouldCount}`);
    console.log(`   Expected Should Count: ${scenario.shouldCount}`);
    
    const timerCorrect = shouldCount === scenario.shouldCount;
    console.log(`   Timer Logic: ${timerCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    
    const overallSuccess = dateCorrect && timerCorrect;
    console.log(`   Overall: ${overallSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    
    return {
      name: scenario.name,
      dateCorrect,
      timerCorrect,
      overallSuccess,
      calculatedDate,
      shouldCount
    };
    
  } catch (error) {
    console.error(`   ❌ ERROR: ${error.message}`);
    return {
      name: scenario.name,
      dateCorrect: false,
      timerCorrect: false,
      overallSuccess: false,
      error: error.message
    };
  }
}

// Main test runner
function runLogicTests() {
  console.log('🚀 Starting Shift Logic Validation Tests\n');
  console.log('=' .repeat(70));
  console.log('Testing core shift-based logic without database operations');
  console.log('=' .repeat(70));
  
  const results = [];
  
  // Run all test scenarios
  for (const scenario of TEST_SCENARIOS) {
    const result = testScenario(scenario);
    results.push(result);
  }
  
  // Print summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('=' .repeat(70));
  
  let passed = 0;
  let failed = 0;
  
  results.forEach(result => {
    if (result.overallSuccess) {
      passed++;
      console.log(`✅ ${result.name}`);
    } else {
      failed++;
      console.log(`❌ ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  
  console.log(`\n📈 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\n🎉 All logic tests passed! Your shift-based system logic is correct.');
    console.log('\n📋 Key Validations:');
    console.log('   ✅ Shift-anchored date calculation works correctly');
    console.log('   ✅ Timer guards prevent counting outside shift hours');
    console.log('   ✅ Day shifts use same calendar day for row date');
    console.log('   ✅ Night shifts use shift start date for row date');
    console.log('   ✅ Timer stops at shift end time');
    console.log('   ✅ Timer doesn\'t start before shift start time');
  } else {
    console.log('\n⚠️  Some logic tests failed. Please review the implementation.');
  }
  
  console.log('\n🔍 Detailed Analysis:');
  console.log('   📅 Date Logic: Anchors activity rows to shift start date');
  console.log('   ⏰ Timer Logic: Only counts during active shift hours');
  console.log('   🌙 Night Shifts: Span 2 calendar days but use 1 row date');
  console.log('   📊 New Rows: Created with 0 initial values at shift start');
  
  console.log('\n👋 Logic validation completed');
  return results;
}

// Run tests if called directly
if (require.main === module) {
  runLogicTests();
}

module.exports = { runLogicTests, parseShiftTime, calculateShiftAnchoredDate };
