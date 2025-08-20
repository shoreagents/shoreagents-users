#!/usr/bin/env node

/**
 * Debug Break Notifications
 * 
 * This script tests the break notification logic directly
 * to see why notifications aren't being sent.
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Copy the functions from socket-server.js
function parseShiftTime(shiftTime) {
  if (!shiftTime) return null;
  
  const parts = shiftTime.split(' - ');
  if (parts.length !== 2) return null;
  
  const startTime = parts[0].trim();
  const endTime = parts[1].trim();
  
  return { startTime, endTime };
}

function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  const time = timeStr.trim();
  const isPM = time.toLowerCase().includes('pm');
  const isAM = time.toLowerCase().includes('am');
  
  let [hours, minutes] = time.replace(/[ap]m/gi, '').split(':').map(Number);
  
  if (isPM && hours !== 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  
  return { hours, minutes };
}

function getBreakWindows(shiftInfo) {
  if (!shiftInfo || !shiftInfo.shift_time) return null;
  
  const { startTime, endTime } = parseShiftTime(shiftInfo.shift_time);
  if (!startTime || !endTime) return null;
  
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);
  if (!start || !end) return null;
  
  // Calculate shift duration in hours
  let shiftDuration = end.hours - start.hours;
  if (shiftDuration <= 0) shiftDuration += 24; // Handle overnight shifts
  
  // Add minutes
  const startMinutes = start.hours + (start.minutes / 60);
  const endMinutes = end.hours + (end.minutes / 60);
  let duration = endMinutes - startMinutes;
  if (duration <= 0) duration += 24;
  
  console.log(`Shift duration: ${duration.toFixed(2)} hours`);
  console.log(`Start time (decimal): ${startMinutes.toFixed(2)}`);
  console.log(`End time (decimal): ${endMinutes.toFixed(2)}`);
  
  // Use fixed break times that match the dashboard display
  // Based on the dashboard showing: Morning (8:23 AM - 10:23 AM), Lunch (10:45 AM - 1:15 PM), Afternoon (1:08 PM - 3:00 PM)
  
  const windows = {
    morning: {
      start: "08:23",
      end: "10:23"
    },
    lunch: {
      start: "10:45", 
      end: "13:15"  // 1:15 PM
    },
    afternoon: {
      start: "13:08",  // 1:08 PM
      end: "15:00"     // 3:00 PM
    }
  };
  
  return windows;
}

function getBreakNotificationTiming(window, currentTime) {
  const now = new Date();
  const currentHour = now.getHours() + (now.getMinutes() / 60);
  
  // Parse window times
  const [startHour, startMinute] = window.start.split(':').map(Number);
  const [endHour, endMinute] = window.end.split(':').map(Number);
  
  const windowStart = startHour + (startMinute / 60);
  const windowEnd = endHour + (endMinute / 60);
  
  console.log(`Current time: ${currentHour.toFixed(2)}`);
  console.log(`Window: ${windowStart.toFixed(2)} - ${windowEnd.toFixed(2)}`);
  
  // Check if break is currently available
  const isAvailable = currentHour >= windowStart && currentHour <= windowEnd;
  
  // Calculate time until expiry
  const timeUntilExpiry = windowEnd - currentHour;
  
  // Determine notification type
  let isExpiringSoon = false;
  let isFinalWarning = false;
  
  if (isAvailable) {
    if (timeUntilExpiry <= 0.25) { // 15 minutes or less
      isFinalWarning = true;
    } else if (timeUntilExpiry <= 0.5) { // 30 minutes or less
      isExpiringSoon = true;
    }
  }
  
  return {
    isAvailable,
    isExpiringSoon,
    isFinalWarning,
    timeUntilExpiry: timeUntilExpiry > 0 ? timeUntilExpiry : 0
  };
}

async function debugBreakNotifications() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Debugging Break Notifications...\n');
    
    // Get current time
    const now = new Date();
    console.log(`Current time: ${now.toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`);
    console.log(`Current hour: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}\n`);
    
    // Get user's shift info
    const userQuery = `
      SELECT ji.shift_time, ji.shift_period, ji.shift_schedule
      FROM job_info ji
      WHERE ji.agent_user_id = (SELECT id FROM users WHERE email = 'kyle.p@shoreagents.com' LIMIT 1)
      LIMIT 1
    `;
    
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No user found with email kyle@shoreagents.com');
      return;
    }
    
    const shiftInfo = userResult.rows[0];
    console.log('📋 User Shift Info:');
    console.log(`   Shift Time: ${shiftInfo.shift_time}`);
    console.log(`   Shift Period: ${shiftInfo.shift_period}`);
    console.log(`   Shift Schedule: ${shiftInfo.shift_schedule}\n`);
    
    // Calculate break windows
    const breakWindows = getBreakWindows(shiftInfo);
    console.log('⏰ Break Windows:');
    console.log(JSON.stringify(breakWindows, null, 2));
    
    if (!breakWindows) {
      console.log('❌ Could not calculate break windows');
      return;
    }
    
    // Check each break window
    for (const [breakType, window] of Object.entries(breakWindows)) {
      console.log(`\n🔍 Checking ${breakType} break:`);
      
      const timing = getBreakNotificationTiming(window, now);
      console.log(`   Available: ${timing.isAvailable}`);
      console.log(`   Expiring Soon: ${timing.isExpiringSoon}`);
      console.log(`   Final Warning: ${timing.isFinalWarning}`);
      console.log(`   Time Until Expiry: ${timing.timeUntilExpiry.toFixed(2)} hours`);
      
      // Check if notification should be sent
      if (timing.isAvailable) {
        if (timing.isFinalWarning) {
          console.log(`   🚨 SHOULD SEND: Final Warning notification!`);
        } else if (timing.isExpiringSoon) {
          console.log(`   ⚠️  SHOULD SEND: Expiring Soon notification!`);
        } else {
          console.log(`   ✅ Available but no notification needed yet`);
        }
      } else {
        console.log(`   ❌ Not available at this time`);
      }
    }
    
    // Check if any notifications exist for today
    const notificationsQuery = `
      SELECT id, type, title, message, created_at
      FROM notifications 
      WHERE user_id = (SELECT id FROM users WHERE email = 'kyle@shoreagents.com' LIMIT 1)
      AND category = 'break'
      AND created_at >= CURRENT_DATE
      ORDER BY created_at DESC
    `;
    
    const notificationsResult = await client.query(notificationsQuery);
    console.log(`\n📢 Break Notifications Today: ${notificationsResult.rows.length}`);
    
    if (notificationsResult.rows.length > 0) {
      notificationsResult.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title} (${notification.type})`);
        console.log(`      ${notification.message}`);
        console.log(`      Created: ${notification.created_at}`);
      });
    }
    
    // Test the database function directly
    console.log('\n🧪 Testing database function directly...');
    try {
      await client.query('SELECT check_break_availability()');
      console.log('✅ Database function executed successfully');
    } catch (error) {
      console.log('❌ Database function failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugBreakNotifications().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { debugBreakNotifications };
