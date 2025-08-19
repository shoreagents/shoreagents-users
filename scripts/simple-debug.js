#!/usr/bin/env node

console.log('🔍 Simple Debug: Break Timing Logic\n');

// Test with Kyle's shift
const shiftTime = "6:00 AM - 3:00 PM";
const currentTime = new Date();
currentTime.setHours(13, 57, 0, 0); // 1:57 PM

console.log(`Shift: ${shiftTime}`);
console.log(`Current time: ${currentTime.toLocaleTimeString()}`);
console.log(`Current time (24h): ${currentTime.getHours()}:${currentTime.getMinutes()}`);

// Parse shift time
const parts = shiftTime.split(' - ');
const startTime = parts[0].trim(); // "6:00 AM"
const endTime = parts[1].trim();   // "3:00 PM"

console.log(`\nParsed shift times:`);
console.log(`Start: ${startTime}`);
console.log(`End: ${endTime}`);

// Convert to 24-hour
function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  
  if (hours === '12') {
    hours = modifier === 'PM' ? '12' : '00';
  } else if (modifier === 'PM') {
    hours = String(parseInt(hours) + 12);
  }
  
  return `${hours}:${minutes}`;
}

const start24 = convertTo24Hour(startTime);
const end24 = convertTo24Hour(endTime);

console.log(`\nConverted to 24-hour:`);
console.log(`Start: ${start24}`);
console.log(`End: ${end24}`);

// Calculate shift duration
const [startHour, startMinute] = start24.split(':').map(Number);
const [endHour, endMinute] = end24.split(':').map(Number);

const shiftDuration = (endHour + (endMinute / 60)) - (startHour + (startMinute / 60));

console.log(`\nShift duration: ${shiftDuration} hours`);

// Calculate break times
const morningBreakStart = startHour + (shiftDuration * 0.25);
const lunchBreakStart = startHour + (shiftDuration * 0.5);
const afternoonBreakStart = startHour + (shiftDuration * 0.75);

console.log(`\nBreak start times (decimal hours):`);
console.log(`Morning: ${morningBreakStart}`);
console.log(`Lunch: ${lunchBreakStart}`);
console.log(`Afternoon: ${afternoonBreakStart}`);

// Format break times
function formatTime(hour) {
  const adjustedHour = Math.floor(hour) % 24;
  const minutes = Math.round((hour - Math.floor(hour)) * 60);
  return `${adjustedHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

const morningBreak = formatTime(morningBreakStart);
const lunchBreak = formatTime(lunchBreakStart);
const afternoonBreak = formatTime(afternoonBreakStart);

console.log(`\nFormatted break times:`);
console.log(`Morning: ${morningBreak}`);
console.log(`Lunch: ${lunchBreak}`);
console.log(`Afternoon: ${afternoonBreak}`);

// Test afternoon break validation
console.log(`\n🔍 Testing Afternoon Break Validation:`);

const currentHour = currentTime.getHours();
const currentMinute = currentTime.getMinutes();
const currentMinutes = currentHour * 60 + currentMinute;

const [breakStartHour, breakStartMinute] = afternoonBreak.split(':').map(Number);
const breakStartMinutes = breakStartHour * 60 + breakStartMinute;
const breakEndMinutes = breakStartMinutes + (2 * 60); // 2-hour window

console.log(`Current time: ${currentHour}:${currentMinute} = ${currentMinutes} minutes`);
console.log(`Break start: ${breakStartHour}:${breakStartMinute} = ${breakStartMinutes} minutes`);
console.log(`Break end: ${Math.floor(breakEndMinutes/60)}:${breakEndMinutes%60} = ${breakEndMinutes} minutes`);

// Check if available (with 30-minute buffer)
const bufferMinutes = 30;
const adjustedStartMinutes = breakStartMinutes - bufferMinutes;

console.log(`\nBuffer calculation:`);
console.log(`Buffer: ${bufferMinutes} minutes`);
console.log(`Adjusted start: ${adjustedStartMinutes} minutes (${Math.floor(adjustedStartMinutes/60)}:${adjustedStartMinutes%60})`);

const isAvailable = currentMinutes >= adjustedStartMinutes && currentMinutes <= breakEndMinutes;

console.log(`\nValidation logic:`);
console.log(`${currentMinutes} >= ${adjustedStartMinutes} && ${currentMinutes} <= ${breakEndMinutes}`);
console.log(`${currentMinutes >= adjustedStartMinutes} && ${currentMinutes <= breakEndMinutes}`);
console.log(`Result: ${isAvailable}`);

console.log(`\n🎯 Final Result:`);
console.log(`Afternoon Break: ${isAvailable ? '✅ Available' : '❌ Not Available'}`);
