#!/usr/bin/env node
/*
 * Test Break Notification Timing
 * This script demonstrates when notifications should be sent for breaks
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// Mock the functions from shift-break-utils.ts for testing
function parseShiftTime(shiftTime) {
  if (!shiftTime) return null;
  
  const parts = shiftTime.split(' - ');
  if (parts.length !== 2) return null;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  return { start: startTime, end: endTime };
}

function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  hours = hours.padStart(2, '0');
  minutes = minutes.padStart(2, '0');
  
  if (hours === '12') {
    hours = modifier === 'PM' ? '12' : '00';
  } else if (modifier === 'PM') {
    hours = String(parseInt(hours) + 12);
  }
  
  return `${hours}:${minutes}`;
}

function isNightShift(shiftTime) {
  const parsed = parseShiftTime(shiftTime);
  if (!parsed) return false;
  
  const start24 = convertTo24Hour(parsed.start);
  const end24 = convertTo24Hour(parsed.end);
  
  const startHour = parseInt(start24.split(':')[0]);
  const endHour = parseInt(end24.split(':')[0]);
  
  return startHour > endHour;
}

function calculateBreakTimes(shiftTime) {
  const parsed = parseShiftTime(shiftTime);
  if (!parsed) return null;
  
  const start24 = convertTo24Hour(parsed.start);
  const end24 = convertTo24Hour(parsed.end);
  
  const [startHour, startMinute] = start24.split(':').map(Number);
  const [endHour, endMinute] = end24.split(':').map(Number);
  
  const isNight = isNightShift(shiftTime);
  
  let shiftDuration;
  if (isNight) {
    shiftDuration = (24 - startHour) + endHour + (endMinute / 60) - (startMinute / 60);
  } else {
    shiftDuration = (endHour + (endMinute / 60)) - (startHour + (startMinute / 60));
  }
  
  let morningBreakStart, morningBreakEnd;
  let lunchBreakStart, lunchBreakEnd;
  let afternoonBreakStart, afternoonBreakEnd;
  
  if (shiftDuration < 4) {
    return null;
  } else if (shiftDuration < 6) {
    const breakTime = startHour + (shiftDuration * 0.5);
    morningBreakStart = Math.floor(breakTime);
    morningBreakEnd = Math.min(morningBreakStart + 2, endHour);
    
    lunchBreakStart = 0; lunchBreakEnd = 0;
    afternoonBreakStart = 0; afternoonBreakEnd = 0;
  } else if (shiftDuration < 8) {
    morningBreakStart = startHour + (shiftDuration * 0.33);
    morningBreakEnd = Math.min(morningBreakStart + 2, endHour);
    
    lunchBreakStart = startHour + (shiftDuration * 0.66);
    lunchBreakEnd = Math.min(lunchBreakStart + 2.5, endHour);
    
    afternoonBreakStart = 0; afternoonBreakEnd = 0;
  } else {
    morningBreakStart = startHour + (shiftDuration * 0.25);
    morningBreakEnd = Math.min(morningBreakStart + 2, endHour);
    
    lunchBreakStart = startHour + (shiftDuration * 0.5);
    lunchBreakEnd = Math.min(lunchBreakStart + 2.5, endHour);
    
    afternoonBreakStart = startHour + (shiftDuration * 0.75);
    afternoonBreakEnd = Math.min(afternoonBreakStart + 2, endHour);
  }
  
  const formatTime = (hour) => {
    const adjustedHour = Math.floor(hour) % 24;
    const minutes = Math.round((hour - Math.floor(hour)) * 60);
    return `${adjustedHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  return {
    morning: {
      start: formatTime(morningBreakStart),
      end: formatTime(morningBreakEnd)
    },
    lunch: {
      start: formatTime(lunchBreakStart),
      end: formatTime(lunchBreakEnd)
    },
    afternoon: {
      start: formatTime(afternoonBreakStart),
      end: formatTime(afternoonBreakEnd)
    }
  };
}

function isBreakTimeValid(breakInfo, shiftInfo, currentTime) {
  const parsedShift = parseShiftTime(shiftInfo.shift_time);
  if (!parsedShift) return false;
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;
  
  const [breakStartHour, breakStartMinute] = breakInfo.startTime.split(':').map(Number);
  const [breakEndHour, breakEndMinute] = breakInfo.endTime.split(':').map(Number);
  
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute;
  const breakEndMinutes = breakEndHour * 60 + breakEndMinute;
  
  // Add debug output
  console.log(`\n🔍 DEBUG: ${breakInfo.name}`);
  console.log(`   Current time: ${currentHour}:${currentMinute} = ${currentMinutes} minutes`);
  console.log(`   Break start: ${breakStartHour}:${breakStartMinute} = ${breakStartMinutes} minutes`);
  console.log(`   Break end: ${breakEndHour}:${breakEndMinute} = ${breakEndMinutes} minutes`);
  
  if (isNightShift(shiftInfo.shift_time)) {
    console.log(`   Night shift logic`);
    if (breakStartHour > breakEndHour) {
      if (currentHour >= breakStartHour || currentHour < breakEndHour) {
        console.log(`   ✅ Available (crosses midnight)`);
        return true;
      }
    } else {
      if (currentMinutes >= breakStartMinutes && currentMinutes <= breakEndMinutes) {
        console.log(`   ✅ Available (same day)`);
        return true;
      }
    }
  } else {
    console.log(`   Day shift logic`);
    const bufferMinutes = 30;
    const adjustedStartMinutes = breakStartMinutes - bufferMinutes;
    
    console.log(`   Buffer: ${bufferMinutes} minutes`);
    console.log(`   Adjusted start: ${adjustedStartMinutes} minutes (${Math.floor(adjustedStartMinutes/60)}:${adjustedStartMinutes%60})`);
    
    if (currentMinutes >= adjustedStartMinutes && currentMinutes <= breakEndMinutes) {
      console.log(`   ✅ Available (within buffer window)`);
      console.log(`   ${currentMinutes} >= ${adjustedStartMinutes} && ${currentMinutes} <= ${breakEndMinutes}`);
      return true;
    } else {
      console.log(`   ❌ Not available`);
      console.log(`   ${currentMinutes} >= ${adjustedStartMinutes} && ${currentMinutes} <= ${breakEndMinutes}`);
      console.log(`   Result: ${currentMinutes >= adjustedStartMinutes} && ${currentMinutes <= breakEndMinutes}`);
    }
  }
  
  return false;
}

function getBreakNotificationTiming(breakInfo, shiftInfo, currentTime) {
  const parsedShift = parseShiftTime(shiftInfo.shift_time);
  if (!parsedShift) {
    return {
      isAvailable: false,
      isExpiringSoon: false,
      isFinalWarning: false,
      timeUntilExpiry: 0,
      nextNotificationTime: null
    };
  }
  
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;
  
  const [breakStartHour, breakStartMinute] = breakInfo.startTime.split(':').map(Number);
  const [breakEndHour, breakEndMinute] = breakInfo.endTime.split(':').map(Number);
  
  const breakStartMinutes = breakStartHour * 60 + breakStartMinute;
  const breakEndMinutes = breakEndHour * 60 + breakEndMinute;
  
  const isAvailable = isBreakTimeValid(breakInfo, shiftInfo, currentTime);
  const timeUntilExpiry = breakEndMinutes - currentMinutes;
  const isExpiringSoon = timeUntilExpiry <= 15 && timeUntilExpiry > 5;
  const isFinalWarning = timeUntilExpiry <= 5 && timeUntilExpiry > 0;
  
  let nextNotificationTime = null;
  
  if (isAvailable && !isExpiringSoon && !isFinalWarning) {
    const expiryWarningTime = new Date(currentTime);
    expiryWarningTime.setMinutes(expiryWarningTime.getMinutes() + (timeUntilExpiry - 15));
    nextNotificationTime = expiryWarningTime;
  } else if (isExpiringSoon && !isFinalWarning) {
    const finalWarningTime = new Date(currentTime);
    finalWarningTime.setMinutes(finalWarningTime.getMinutes() + (timeUntilExpiry - 5));
    nextNotificationTime = finalWarningTime;
  }
  
  return {
    isAvailable,
    isExpiringSoon,
    isFinalWarning,
    timeUntilExpiry: Math.max(0, timeUntilExpiry),
    nextNotificationTime
  };
}

function getBreakNotificationMessage(breakInfo, notificationType) {
  switch (notificationType) {
    case 'available':
      return `${breakInfo.name} is now available! You can take your ${breakInfo.duration}-minute break.`;
    
    case 'expiring_soon':
      return `⚠️ ${breakInfo.name} expires in 15 minutes! Take your break now or you'll miss it today.`;
    
    case 'final_warning':
      return `🚨 ${breakInfo.name} expires in 5 minutes! This is your last chance to take it today.`;
    
    default:
      return `${breakInfo.name} notification`;
  }
}

async function main() {
  console.log('🧪 Testing Break Notification Timing\n');
  
  // Test with the actual shift times from the database
  const testShifts = [
    {
      name: "Kyle (Day Shift)",
      shiftTime: "6:00 AM - 3:00 PM",
      shiftPeriod: "Day Shift"
    },
    {
      name: "App Agent (Night Shift)", 
      shiftTime: "2:00 PM - 6:00 PM",
      shiftPeriod: "Night Shift"
    }
  ];

  const currentTime = new Date();
  console.log(`🕐 Current time: ${currentTime.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
  console.log(`🕐 Current time (local): ${currentTime.toLocaleString()}\n`);

  testShifts.forEach(shift => {
    console.log(`📊 Testing: ${shift.name}`);
    console.log(`   Shift: ${shift.shiftTime}`);
    console.log(`   Period: ${shift.shiftPeriod}`);
    
    const breakTimes = calculateBreakTimes(shift.shiftTime);
    if (breakTimes) {
      console.log(`   ✅ Break times calculated:`);
      console.log(`      Morning: ${breakTimes.morning.start} - ${breakTimes.morning.end}`);
      console.log(`      Lunch: ${breakTimes.lunch.start} - ${breakTimes.lunch.end}`);
      console.log(`      Afternoon: ${breakTimes.afternoon.start} - ${breakTimes.afternoon.end}`);
      
      // Test notification timing for each break
      const breaks = [
        {
          id: "Morning",
          name: "Morning Break",
          duration: 15,
          startTime: breakTimes.morning.start,
          endTime: breakTimes.morning.end
        },
        {
          id: "Lunch",
          name: "Lunch Break",
          duration: 60,
          startTime: breakTimes.lunch.start,
          endTime: breakTimes.lunch.end
        },
        {
          id: "Afternoon",
          name: "Afternoon Break",
          duration: 15,
          startTime: breakTimes.afternoon.start,
          endTime: breakTimes.afternoon.end
        }
      ];
      
      console.log(`\n   🔔 Notification Timing Analysis:`);
      
      breaks.forEach(breakInfo => {
        if (breakInfo.startTime !== "00:00" && breakInfo.endTime !== "00:00") {
          const notificationTiming = getBreakNotificationTiming(breakInfo, shift, currentTime);
          
          console.log(`      ${breakInfo.name}:`);
          console.log(`        Available: ${notificationTiming.isAvailable ? '✅ Yes' : '❌ No'}`);
          console.log(`        Expiring Soon: ${notificationTiming.isExpiringSoon ? '⚠️ Yes' : 'No'}`);
          console.log(`        Final Warning: ${notificationTiming.isFinalWarning ? '🚨 Yes' : 'No'}`);
          console.log(`        Time Until Expiry: ${notificationTiming.timeUntilExpiry} minutes`);
          
          if (notificationTiming.nextNotificationTime) {
            console.log(`        Next Notification: ${notificationTiming.nextNotificationTime.toLocaleTimeString()}`);
          }
          
          // Show notification messages
          if (notificationTiming.isAvailable) {
            if (notificationTiming.isExpiringSoon) {
              console.log(`        Message: ${getBreakNotificationMessage(breakInfo, 'expiring_soon')}`);
            } else if (notificationTiming.isFinalWarning) {
              console.log(`        Message: ${getBreakNotificationMessage(breakInfo, 'final_warning')}`);
            } else {
              console.log(`        Message: ${getBreakNotificationMessage(breakInfo, 'available')}`);
            }
          }
        }
      });
    } else {
      console.log(`   ❌ No break times calculated`);
    }
    console.log('');
  });

  // Test specific notification scenarios
  console.log('🧪 Testing Specific Notification Scenarios\n');
  
  const testScenarios = [
    {
      name: "Morning Break - Just Available",
      time: "8:15 AM",
      break: {
        id: "Morning",
        name: "Morning Break",
        duration: 15,
        startTime: "08:15",
        endTime: "10:15"
      }
    },
    {
      name: "Lunch Break - Expiring Soon",
      time: "12:30 PM",
      break: {
        id: "Lunch",
        name: "Lunch Break",
        duration: 60,
        startTime: "10:30",
        endTime: "13:00"
      }
    },
    {
      name: "Afternoon Break - Final Warning",
      time: "2:40 PM",
      break: {
        id: "Afternoon",
        name: "Afternoon Break",
        duration: 15,
        startTime: "12:45",
        endTime: "14:45"
      }
    }
  ];
  
  testScenarios.forEach(scenario => {
    console.log(`📋 ${scenario.name}`);
    console.log(`   Test Time: ${scenario.time}`);
    console.log(`   Break: ${scenario.break.startTime} - ${scenario.break.endTime}`);
    
    // Create a mock current time with proper AM/PM handling
    const [timePart, modifier] = scenario.time.split(' ');
    const [hour, minute] = timePart.split(':');
    let hour24 = parseInt(hour);
    
    if (modifier === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (modifier === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    const testTime = new Date();
    testTime.setHours(hour24, parseInt(minute), 0, 0);
    
    const mockShift = { shift_time: "8:00 AM - 5:00 PM" };
    
    // Test the break validation with the test time
    console.log(`\n   Testing break availability at ${scenario.time}:`);
    const isValid = isBreakTimeValid(scenario.break, mockShift, testTime);
    console.log(`   Available: ${isValid ? '✅ Yes' : '❌ No'}`);
    
    // Now test notification timing
    const notificationTiming = getBreakNotificationTiming(scenario.break, mockShift, testTime);
    
    console.log(`\n   Notification timing:`);
    console.log(`   Status: ${notificationTiming.isAvailable ? 'Available' : 'Not Available'}`);
    console.log(`   Expiring Soon: ${notificationTiming.isExpiringSoon ? 'Yes' : 'No'}`);
    console.log(`   Final Warning: ${notificationTiming.isFinalWarning ? 'Yes' : 'No'}`);
    console.log(`   Time Until Expiry: ${notificationTiming.timeUntilExpiry} minutes`);
    
    if (notificationTiming.isAvailable) {
      let messageType = 'available';
      if (notificationTiming.isExpiringSoon) messageType = 'expiring_soon';
      if (notificationTiming.isFinalWarning) messageType = 'final_warning';
      
      console.log(`   Notification: ${getBreakNotificationMessage(scenario.break, messageType)}`);
    }
    console.log('');
  });
}

main();
