// Debug script to test ALL FIXED timezone conversion logic
const now = new Date();

console.log('🔍 Debugging ALL FIXED timezone conversion methods...');
console.log('⏰ Current UTC time:', now.toISOString());
console.log('🌍 Manila time string:', now.toLocaleString('en-US', {timeZone: 'Asia/Manila'}));

// Test the FIXED logic used in socket server (UTC+8 offset)
const currentTime = new Date();
const manilaTime = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000));
const currentDate = manilaTime.toISOString().split('T')[0];

console.log('📅 Manila time object (FIXED):', manilaTime);
console.log('📅 Current date (Manila, FIXED):', currentDate);
console.log('📅 Expected date should be: 2025-08-26');

// Test the FIXED fallback logic
const lastActivityTime = new Date('2025-08-25T22:46:04.370Z');
const lastDate = new Date(lastActivityTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
const currentDate2 = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];

console.log('📅 Last activity date (Manila, FIXED):', lastDate);
console.log('📅 Current date (Manila, FIXED):', currentDate2);
console.log('🔄 Should reset:', lastDate !== currentDate2);

// Test the shift window detection logic (FIXED)
const nowPH = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
const curMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
console.log('🕐 Shift window detection (FIXED):', nowPH.toISOString());
console.log('🕐 Current minutes from midnight (Manila):', curMinutes);

// Test the fallback calculation logic (FIXED)
const philippinesNow = new Date(new Date().getTime() + (8 * 60 * 60 * 1000));
const currentMinutesLocal = philippinesNow.getHours() * 60 + philippinesNow.getMinutes();
console.log('🕐 Fallback calculation (FIXED):', philippinesNow.toISOString());
console.log('🕐 Current minutes from midnight (Manila, fallback):', currentMinutesLocal);

// Test the shift start logic
const shiftStartTime = new Date('2025-08-25T22:49:00.000Z');
console.log('🕐 Shift start time (UTC):', shiftStartTime.toISOString());
console.log('🕐 Shift start time (Manila):', shiftStartTime.toLocaleString('en-US', {timeZone: 'Asia/Manila'}));

// Test the exact condition from the logs
const timeDiff = Math.abs(currentTime.getTime() - shiftStartTime.getTime());
const isExactlyAtShiftStart = timeDiff <= 1000;
const isJustPassedShiftStart = currentTime.getTime() >= shiftStartTime.getTime() && timeDiff <= 5000;

console.log('⏱️ Time difference (ms):', timeDiff);
console.log('🎯 Is exactly at shift start:', isExactlyAtShiftStart);
console.log('🎯 Is just passed shift start:', isJustPassedShiftStart);
console.log('🔄 Should reset based on timing:', isExactlyAtShiftStart || isJustPassedShiftStart);

// Test the old broken logic for comparison
console.log('\n🚨 OLD BROKEN LOGIC (for comparison):');
const oldManilaTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
const oldCurrentDate = oldManilaTime.toISOString().split('T')[0];
console.log('📅 Old Manila time object:', oldManilaTime);
console.log('📅 Old current date (Manila):', oldCurrentDate);
console.log('❌ This was causing the wrong date to be used!');

// Test the old broken shift window logic
const oldNowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
const oldCurMinutes = oldNowPH.getHours() * 60 + oldNowPH.getMinutes();
console.log('🕐 Old shift window detection:', oldNowPH.toISOString());
console.log('🕐 Old current minutes from midnight (Manila):', oldCurMinutes);
console.log('❌ This was also causing wrong shift window detection!');
