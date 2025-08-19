require('dotenv').config({ path: '.env.local' });

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const BreakReminderScheduler = require('./scripts/break-reminder-scheduler');

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Database connection - use the same Railway database as Next.js app
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Initialize break reminder scheduler
const breakReminderScheduler = new BreakReminderScheduler();
console.log('🔔 Initializing break reminder scheduler...');
breakReminderScheduler.start();

// Monitor database connection pool
setInterval(() => {
  if (pool) {
    const poolStatus = {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    };
    
    // Log warning if too many connections
    if (poolStatus.total > 10) {
      console.warn(`⚠️ High database connections: ${poolStatus.total} total, ${poolStatus.idle} idle, ${poolStatus.waiting} waiting`);
    }
    
    // Log every 5 minutes for monitoring
    if (Date.now() % 300000 < 1000) { // Every 5 minutes
      console.log(`📊 Database pool status: ${poolStatus.total} total, ${poolStatus.idle} idle, ${poolStatus.waiting} waiting`);
    }
  }
}, 60000); // Check every minute

// In-memory storage for testing (since PostgreSQL is not running)
const connectedUsers = new Map();
const userData = new Map(); // Store user activity data in memory
const userMeetingStatus = new Map(); // Store user meeting status in memory
const userShiftInfo = new Map(); // Store user shift information for shift-based resets

// Initialize with test data
userData.set('bob@example.com', {
  userId: 1,
  isActive: false,
  activeSeconds: 0,
  inactiveSeconds: 0,
  sessionStart: new Date().toISOString()
});

// Keep track of active connections per user
const userConnections = new Map(); // email -> Set of socket IDs
// Track last break-availability notifications to avoid spamming
// REMOVED: No longer needed since database functions handle all notifications

// Shift utility functions (Node.js compatible version)
function parseShiftTime(shiftTimeString, referenceDate = new Date()) {
  if (!shiftTimeString) return null;

  try {
    // Extract just the time portion, ignoring period and schedule
    const timeMatch = shiftTimeString.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    if (!timeMatch) return null;

    const [, startTimeStr, endTimeStr] = timeMatch;

    // Parse start and end times
    const today = new Date(referenceDate);
    today.setSeconds(0, 0); // Reset seconds and milliseconds

    const startTime = parseTimeString(startTimeStr, today);
    let endTime = parseTimeString(endTimeStr, today);

    // If end time is before start time, it means shift crosses midnight
    const isNightShift = endTime <= startTime;
    if (isNightShift) {
      // Add one day to end time for night shifts
      endTime = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
    }

    return {
      period: isNightShift ? "Night Shift" : "Day Shift",
      schedule: "", 
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

  const result = new Date(baseDate);
  
  let hour24 = hours;
  if (period?.toUpperCase() === 'PM' && hours !== 12) {
    hour24 += 12;
  } else if (period?.toUpperCase() === 'AM' && hours === 12) {
    hour24 = 0;
  }

  result.setHours(hour24, minutes, 0, 0);
  return result;
}

// Function to check if current time has passed shift start time since last activity
function shouldResetForShift(lastActivityTime, currentTime, shiftInfo) {
  if (!shiftInfo) {
    // Fallback to daily reset if no shift info
    // Use UTC-based date comparison to avoid timezone issues
    const lastDate = lastActivityTime.toISOString().split('T')[0];
    const currentDate = currentTime.toISOString().split('T')[0];
    return lastDate !== currentDate;
  }

  // Compute the start boundary for the shift window that the CURRENT time belongs to
  const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
  
  // Add debug logging
  console.log(`🕐 Shift reset check for ${shiftInfo.period}:`, {
    lastActivity: lastActivityTime.toISOString(),
    currentTime: currentTime.toISOString(),
    currentShiftStart: currentShiftStart.toISOString(),
    timeDiff: currentTime.getTime() - currentShiftStart.getTime(),
    shouldReset: (lastActivityTime < currentShiftStart) && (currentTime >= currentShiftStart)
  });
  
  // Reset when we CROSS the shift start boundary OR when we're at the exact shift start time
  // This handles both cases: crossing the boundary and being exactly at the boundary
  const isAtOrPastShiftStart = currentTime >= currentShiftStart;
  const wasBeforeShiftStart = lastActivityTime < currentShiftStart;
  
  // Also check if we're within 10 seconds of the shift start time (for edge cases)
  const timeDiff = Math.abs(currentTime.getTime() - currentShiftStart.getTime());
  const isNearShiftStart = timeDiff <= 10000; // 10 seconds
  
  // More aggressive reset detection: reset if we're very close to shift start time
  const shouldReset = (wasBeforeShiftStart && isAtOrPastShiftStart) || isNearShiftStart;
  
  // Special case: if we're exactly at or just passed the shift start time, always reset
  const isExactlyAtShiftStart = timeDiff <= 1000; // Within 1 second
  const isJustPassedShiftStart = currentTime.getTime() >= currentShiftStart.getTime() && timeDiff <= 5000; // Within 5 seconds after
  
  if (isExactlyAtShiftStart || isJustPassedShiftStart) {
    console.log(`🎯 Exact shift start time detected: isExactly=${isExactlyAtShiftStart}, isJustPassed=${isJustPassedShiftStart}`);
    return true;
  }
  
  if (shouldReset) {
    console.log(`🔄 Shift reset condition met: wasBefore=${wasBeforeShiftStart}, isAtOrPast=${isAtOrPastShiftStart}, isNear=${isNearShiftStart}, timeDiff=${timeDiff}ms`);
  }
  
  return shouldReset;
}

// Function to check if current time has passed shift start time for today
function hasShiftStartedToday(currentTime, shiftInfo) {
  if (!shiftInfo) return false;
  
  const todayShiftStart = getShiftStartForDate(currentTime, shiftInfo);
  return currentTime >= todayShiftStart;
}

// Function to get next shift start time
function getNextShiftStart(currentTime, shiftInfo) {
  if (!shiftInfo) {
    // Fallback to next day at midnight Philippines time
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
  
  if (currentTime < currentShiftStart) {
    // Shift hasn't started today yet
    return currentShiftStart;
  } else {
    // Shift has started today, get next shift start
    const nextShiftStart = new Date(currentShiftStart);
    nextShiftStart.setDate(nextShiftStart.getDate() + 1);
    return nextShiftStart;
  }
}

// Compute standard break windows relative to shift start
function getBreakWindows(shiftInfo) {
  // Returns map of break_type -> { start: Date, end: Date }
  // Uses consistent pattern for ALL shifts: Morning (+2h, 1h), Lunch (+4h, 3h), Afternoon (+7h45m, 1h)
  const windows = new Map();
  const base = getShiftStartForDate(new Date(), shiftInfo);
  const addWindow = (breakType, offsetMinutes, durationMinutes) => {
    const s = new Date(base.getTime() + offsetMinutes * 60 * 1000);
    const e = new Date(s.getTime() + durationMinutes * 60 * 1000);
    windows.set(breakType, { start: s, end: e });
  };
  
  // ALL SHIFTS NOW USE THE SAME CONSISTENT PATTERN
  // Morning: 2 hours after start (1 hour duration)
  // Lunch: 4 hours after start (3 hours duration) 
  // Afternoon: 7h45m after start (1 hour duration)
  if (shiftInfo?.isNightShift) {
    // Night shift uses same timing pattern but different break type names
                    addWindow('NightFirst', 120, 60);    // Morning equivalent: +2h, 1h
                addWindow('NightMeal', 240, 180);    // Lunch equivalent: +4h, 3h
                addWindow('NightSecond', 465, 60);   // Afternoon equivalent: +7h45m, 1h
  } else {
    // Day shift with consistent timing
    addWindow('Morning', 120, 60);       // +2h, 1h
    addWindow('Lunch', 240, 180);        // +4h, 3h
    addWindow('Afternoon', 465, 60);     // +7h45m, 1h
  }
  return windows;
}

function isWithinWindow(now, window) {
  return now >= window.start && now <= window.end;
}



// Function to get user shift information from database
async function getUserShiftInfo(userId) {
  try {
    const query = `
      SELECT ji.shift_period, ji.shift_schedule, ji.shift_time
      FROM job_info ji
      LEFT JOIN agents a ON ji.agent_user_id = a.user_id
      WHERE (ji.agent_user_id = $1 OR ji.internal_user_id = $1)
      AND ji.shift_time IS NOT NULL
      LIMIT 1
    `;
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length > 0) {
      const shiftData = result.rows[0];
      const shiftInfo = parseShiftTime(shiftData.shift_time);
      
      if (shiftInfo) {
        shiftInfo.period = shiftData.shift_period || shiftInfo.period;
        shiftInfo.schedule = shiftData.shift_schedule || shiftInfo.schedule;
        console.log(`🕐 Retrieved shift info for user ${userId}: ${shiftInfo.period} (${shiftInfo.time})`);
        return shiftInfo;
      }
    }
    
    console.log(`⏰ No shift info found for user ${userId}, using calendar-based reset`);
    return null;
  } catch (error) {
    console.error('Error getting user shift info:', error);
    return null;
  }
}

// Function to get user meeting status from database
async function getUserMeetingStatus(userId) {
  try {
    const query = 'SELECT is_user_in_meeting($1) as is_in_meeting';
    const result = await pool.query(query, [userId]);
    return result.rows[0]?.is_in_meeting || false;
  } catch (error) {
    console.error('Error getting user meeting status:', error);
    return false;
  }
}

// Function to broadcast meeting status to all user connections
function broadcastMeetingStatus(email, isInMeeting) {
  const userSockets = userConnections.get(email);
  if (userSockets) {
    userSockets.forEach(socketId => {
      io.to(socketId).emit('meeting-status-update', { isInMeeting });
    });
    // Broadcasted meeting status update;
  }
}

// Function to check if shift reset is needed for a user
async function checkShiftReset(email, userId) {
  try {
    const shiftInfo = userShiftInfo.get(email);
    if (!shiftInfo) return false;
    
    const currentTime = new Date();
    const userInfo = userData.get(email);
    
    if (!userInfo) return false;
    
    const lastActivityTime = new Date(userInfo.sessionStart);
    
    // Check if we should reset based on shift schedule
    const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
    
    if (shouldReset) {
      // Debounce: avoid duplicate resets within 2 minutes
      // Replace time-based debounce with shiftId-based guard only
      if (userInfo.lastShiftId && userInfo.lastShiftId === getCurrentShiftId(currentTime, shiftInfo)) {
        return false;
      }

      // Extra guard: only reset if shift identifier changed
      const currentShiftId = getCurrentShiftId(currentTime, shiftInfo);
      if (userInfo.lastShiftId && userInfo.lastShiftId === currentShiftId) {
        return false;
      }
      console.log(`🔄 Shift reset detected for ${email} (${shiftInfo.period}: ${shiftInfo.time})`);
      
      // Preserve current activity state after reset
      const preserveActive = !!userInfo.isActive;
      
      // Reset user data
      userInfo.activeSeconds = 0;
      userInfo.inactiveSeconds = 0;
      userInfo.isActive = preserveActive;
      userInfo.sessionStart = new Date().toISOString();
      userInfo.lastResetAt = Date.now();
      userInfo.lastShiftId = currentShiftId;
      
      // Get current date in Philippines timezone
      const currentDate = new Date().toISOString().split('T')[0]; // Use UTC date for consistency
      
      // Reset today's row in DB (upsert to handle existing row)
      await pool.query(
        `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at)
         VALUES ($1, $4, 0, 0, $2, $3, NOW())
         ON CONFLICT (user_id, today_date)
         DO UPDATE SET
           is_currently_active = EXCLUDED.is_currently_active,
           today_active_seconds = 0,
           today_inactive_seconds = 0,
           last_session_start = EXCLUDED.last_session_start,
           updated_at = NOW()`,
        [userId, userInfo.sessionStart, currentDate, preserveActive]
      );
      
      // Notify all user connections about the reset
      const userSockets = userConnections.get(email);
      if (userSockets) {
        const resetData = {
          userId: userInfo.userId,
          email: email,
          isActive: userInfo.isActive,
          activeSeconds: userInfo.activeSeconds,
          inactiveSeconds: userInfo.inactiveSeconds,
          sessionStart: userInfo.sessionStart,
          resetReason: 'shift_change',
          shiftId: currentShiftId
        };
        
        userSockets.forEach(socketId => {
          io.to(socketId).emit('shiftReset', resetData);
          io.to(socketId).emit('timerUpdated', resetData);
        });
        
        console.log(`📡 Notified ${userSockets.size} connections about shift reset for ${email}`);
      }
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking shift reset:', error);
    return false;
  }
}

// Function to get shift start time for a specific date
function getShiftStartForDate(date, shiftInfo) {
  const shiftDate = new Date(date);
  const shiftStartTime = new Date(shiftInfo.startTime);
  
  // Set the date but keep the time from shift start
  shiftDate.setHours(
    shiftStartTime.getHours(),
    shiftStartTime.getMinutes(),
    0, 0
  );

  // For night shifts, if current time is before shift start time,
  // the shift actually started the previous day
  if (shiftInfo.isNightShift && date.getHours() < shiftStartTime.getHours()) {
    shiftDate.setDate(shiftDate.getDate() - 1);
  }

  return shiftDate;
}

// Function to get current shift ID
function getCurrentShiftId(currentTime, shiftInfo) {
  if (!shiftInfo) {
    // Fallback to date-based ID using UTC
    return currentTime.toISOString().split('T')[0];
  }

  const shiftStart = getShiftStartForDate(currentTime, shiftInfo);
  
  if (shiftInfo.isNightShift) {
    // For night shifts, use the date when the shift started
    return shiftStart.toISOString().split('T')[0] + '-night';
  } else {
    // For day shifts, use the current date
    return currentTime.toISOString().split('T')[0] + '-day';
  }
}

// Function to get time until next shift reset
function getTimeUntilNextReset(currentTime, shiftInfo) {
  if (!shiftInfo) {
    // Fallback to next day at midnight Philippines time
    const tomorrow = new Date(currentTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - currentTime.getTime();
  }

  const nextShiftStart = getNextShiftStart(currentTime, shiftInfo);
  return nextShiftStart.getTime() - currentTime.getTime();
}

// Function to format time until reset
function formatTimeUntilReset(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

io.on('connection', (socket) => {

  // Handle user authentication
  socket.on('authenticate', async (email) => {
    try {
      
      if (!email) {
        socket.emit('error', { message: 'Email is required' });
        return;
      }
      
      // Get or create user data
      let userInfo = userData.get(email);
      if (!userInfo) {
        // Creating new user data;
        userInfo = {
          userId: null, // Will be set after database lookup
          isActive: false,
          activeSeconds: 0,
          inactiveSeconds: 0,
          sessionStart: new Date().toISOString(),
          lastResetAt: null,
          lastShiftId: null
        };
        
        // Try to load existing data from database
        try {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
          let userId;
          
          if (userResult.rows.length === 0) {
            const newUserResult = await pool.query('INSERT INTO users (email) VALUES ($1) RETURNING id', [email]);
            userId = newUserResult.rows[0].id;
          } else {
            userId = userResult.rows[0].id;
          }
          
          // Set the user ID to the database ID
          userInfo.userId = userId;
          
          // Get user shift information for shift-based resets
          const shiftInfo = await getUserShiftInfo(userId);
          userShiftInfo.set(email, shiftInfo);
          
          if (shiftInfo) {
            console.log(`👤 User ${email} has ${shiftInfo.period} schedule: ${shiftInfo.time}`);
          }
          
          // Load activity data from database (shift-aware or daily)
          const currentTime = new Date();
          const currentDate = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format for Philippines
          
          // First check if there's any activity data for this user
          const activityResult = await pool.query(
            `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
             FROM activity_data 
             WHERE user_id = $1 
             ORDER BY today_date DESC 
             LIMIT 1`,
            [userId]
          );
          
          if (activityResult.rows.length > 0) {
            const dbData = activityResult.rows[0];
            const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            const lastActivityTime = new Date(dbData.last_session_start || dbData.today_date);
            
            console.log(`📅 User ${email} - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
            
            // Check if we should reset based on shift schedule
            const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
            
            if (!shouldReset) {
              // Same shift period - use existing values
              if (shiftInfo) {
                console.log(`✅ Same shift period detected for ${email} (${shiftInfo.period}) - loading existing timer data`);
              } else {
                console.log(`✅ Same day detected for ${email} - loading existing timer data`);
              }
              userInfo.activeSeconds = dbData.today_active_seconds || 0;
              userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
              userInfo.isActive = dbData.is_currently_active || false;
              userInfo.sessionStart = dbData.last_session_start || new Date().toISOString();
              // Record current shift id to prevent accidental resets later
              if (shiftInfo) {
                userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
              }
            } else {
              // New shift period - reset timers
              if (shiftInfo) {
                console.log(`🔄 New shift period detected for ${email} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
              } else {
                console.log(`🔄 New day detected for ${email} (${dbDate} -> ${currentDate}) - resetting timers`);
              }
              const preserveActive = !!userInfo.isActive;
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = preserveActive;
              userInfo.sessionStart = new Date().toISOString();
              userInfo.lastResetAt = Date.now();
              
              // Reset today's row (upsert) for current shift/day
              await pool.query(
                `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at)
                 VALUES ($1, $4, 0, 0, $2, $3, NOW())
                 ON CONFLICT (user_id, today_date)
                 DO UPDATE SET
                   is_currently_active = EXCLUDED.is_currently_active,
                   today_active_seconds = 0,
                   today_inactive_seconds = 0,
                   last_session_start = EXCLUDED.last_session_start,
                   updated_at = NOW()`,
                [userId, userInfo.sessionStart, currentDate, preserveActive]
              );
              console.log(`📊 Created new activity record for ${email} on ${currentDate}`);
            }
          } else {
            // No existing data found - check if we should reset based on shift start time
            let shouldResetForNewUser = false;
            let resetReason = 'fresh_start';
            
            if (shiftInfo) {
              // Check if current time has passed shift start time today
              const hasShiftStarted = hasShiftStartedToday(currentTime, shiftInfo);
              if (hasShiftStarted) {
                shouldResetForNewUser = true;
                resetReason = 'shift_started';
                console.log(`🔄 User ${email} logging in after shift start time (${shiftInfo.time}) - resetting timers`);
              }
            }
            
            if (shouldResetForNewUser) {
              // Reset timers for user logging in after shift start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = false;
              userInfo.sessionStart = new Date().toISOString();
              userInfo.lastResetAt = Date.now();
              console.log(`⏰ Fresh start with reset for ${email} - ${resetReason}`);
            } else {
              // Normal fresh start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = false;
              userInfo.sessionStart = new Date().toISOString();
              userInfo.lastResetAt = Date.now();
              console.log(`🆕 Fresh start for ${email} - no reset needed`);
            }
            
            // Create initial activity_data record
            await pool.query(
              `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [userId, false, 0, 0, userInfo.sessionStart, currentDate]
            );
          }
          
        } catch (dbError) {
          console.error('Database load failed:', dbError.message);
          // Using fresh start due to database error;
          // Continue with fresh start - don't throw error
        }
        
        userData.set(email, userInfo);
      } else {
        // Found existing user data;
        // Keep existing timer data - don't reset on reconnection
        // But also try to refresh from database to ensure we have latest data and check for new shift
        try {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            
            // Get/refresh user shift information
            const shiftInfo = await getUserShiftInfo(userId);
            userShiftInfo.set(email, shiftInfo);
            
            const currentTime = new Date();
            const currentDate = new Date().toISOString().split('T')[0];
            
            // Get the most recent activity data for this user
            const activityResult = await pool.query(
              `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
               FROM activity_data 
               WHERE user_id = $1 
               ORDER BY today_date DESC 
               LIMIT 1`,
              [userId]
            );
            
            if (activityResult.rows.length > 0) {
              const dbData = activityResult.rows[0];
              const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
              const lastActivityTime = new Date(dbData.last_session_start || dbData.today_date);
              
              console.log(`📅 Refresh check for ${email} - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
              
              // Check if we should reset based on shift schedule
              const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
              
              if (!shouldReset) {
                // Same shift period - update with database data if it's more recent
                if (dbData.today_active_seconds > userInfo.activeSeconds || dbData.today_inactive_seconds > userInfo.inactiveSeconds) {
                  if (shiftInfo) {
                    console.log(`🔄 Updating memory data for ${email} with more recent database data (same shift period: ${shiftInfo.period})`);
                  } else {
                    console.log(`🔄 Updating memory data for ${email} with more recent database data`);
                  }
                  userInfo.activeSeconds = dbData.today_active_seconds || 0;
                  userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
                  userInfo.isActive = dbData.is_currently_active || false;
                  userInfo.sessionStart = dbData.last_session_start || userInfo.sessionStart;
                }
              } else {
              // New shift period - reset for new shift
                if (shiftInfo) {
                  console.log(`🔄 New shift period detected during refresh for ${email} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
                } else {
                  console.log(`🔄 New day detected during refresh for ${email} (${dbDate} -> ${currentDate}) - resetting timers`);
                }
              const preserveActive = !!userInfo.isActive;
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = preserveActive;
              userInfo.sessionStart = new Date().toISOString();
              userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
              userInfo.lastResetAt = Date.now();
                
                // Create new activity_data record for current shift/day
                await pool.query(
                  `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at)
                   VALUES ($1, false, 0, 0, $2, $3, NOW())
                   ON CONFLICT (user_id, today_date)
                   DO UPDATE SET
                     is_currently_active = EXCLUDED.is_currently_active,
                     today_active_seconds = 0,
                     today_inactive_seconds = 0,
                     last_session_start = EXCLUDED.last_session_start,
                     updated_at = NOW()`,
                  [userId, userInfo.sessionStart, currentDate]
                );
                console.log(`📊 Created new activity record during refresh for ${email} on ${currentDate}`);
              }
            } else {
              // No activity data exists, create fresh record
              console.log(`🆕 No activity data found during refresh for ${email} - creating fresh start`);
              
              // Check if we should reset based on shift start time
              let shouldResetForRefresh = false;
              let refreshResetReason = 'fresh_start_refresh';
              
              if (shiftInfo) {
                // Check if current time has passed shift start time today
                const hasShiftStarted = hasShiftStartedToday(currentTime, shiftInfo);
                if (hasShiftStarted) {
                  shouldResetForRefresh = true;
                  refreshResetReason = 'shift_started_refresh';
                  console.log(`🔄 User ${email} refreshing after shift start time (${shiftInfo.time}) - resetting timers`);
                }
              }
              
              if (shouldResetForRefresh) {
                // Reset timers for user refreshing after shift start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = false;
              userInfo.sessionStart = new Date().toISOString();
              userInfo.lastResetAt = Date.now();
                console.log(`⏰ Refresh with reset for ${email} - ${refreshResetReason}`);
              } else {
                // Normal fresh start
                const preserveActive = !!userInfo.isActive;
                userInfo.activeSeconds = 0;
                userInfo.inactiveSeconds = 0;
                userInfo.isActive = preserveActive;
                userInfo.sessionStart = new Date().toISOString();
                console.log(`🆕 Refresh fresh start for ${email} - no reset needed`);
              }
              
                 await pool.query(
                `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
                   VALUES ($1, $2, $3, $4, $5, $6, NOW())
                   ON CONFLICT (user_id, today_date)
                   DO UPDATE SET
                     is_currently_active = EXCLUDED.is_currently_active,
                     today_active_seconds = 0,
                     today_inactive_seconds = 0,
                     last_session_start = EXCLUDED.last_session_start,
                     updated_at = NOW()`,
                   [userId, preserveActive, 0, 0, userInfo.sessionStart, currentDate]
              );
            }
          }
        } catch (dbError) {
          console.error('Database refresh failed:', dbError.message);
        }
      }

      // Store user info
      connectedUsers.set(socket.id, { userId: userInfo.userId, email, userInfo });
      
      // Track user connections
      if (!userConnections.has(email)) {
        userConnections.set(email, new Set());
      }
      userConnections.get(email).add(socket.id);
      
      // User connected;
      
      // Get initial meeting status
      const isInMeeting = await getUserMeetingStatus(userInfo.userId);
      userMeetingStatus.set(email, isInMeeting);
      
      // Send initial data immediately
      const timerData = {
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      };
      
      // Add shift reset information if available
      const shiftInfo = userShiftInfo.get(email);
      if (shiftInfo) {
        const currentTime = new Date();
        const timeUntilReset = getTimeUntilNextReset(currentTime, shiftInfo);
        const formattedTimeUntilReset = formatTimeUntilReset(timeUntilReset);
        
        timerData.shiftInfo = {
          period: shiftInfo.period,
          schedule: shiftInfo.schedule,
          time: shiftInfo.time,
          timeUntilReset: timeUntilReset,
          formattedTimeUntilReset: formattedTimeUntilReset,
          nextResetTime: new Date(currentTime.getTime() + timeUntilReset).toISOString()
        };
        
        console.log(`⏰ Shift reset info for ${email}: ${formattedTimeUntilReset} until next reset`);
      }
      
      socket.emit('authenticated', timerData);
      
      // Send initial meeting status
      socket.emit('meeting-status-update', { isInMeeting });
      
      // Join task activity rooms for real-time updates (by email and by userId)
      socket.join(`task-activity-${email}`);
      if (userInfo.userId) {
        socket.join(`task-user-${userInfo.userId}`);
      }

      // Listen for Postgres NOTIFY on notifications channel per connection
      try {
        const client = await pool.connect();
        await client.query('LISTEN notifications');
        await client.query('LISTEN ticket_comments');
        
        const onNotify = async (msg) => {
          if (msg.channel === 'notifications') {
            try {
              const payload = JSON.parse(msg.payload);
              // Only emit to this user's sockets
              if (payload.user_id && userInfo.userId === payload.user_id) {
                // Shape into our frontend notification format if needed
                socket.emit('db-notification', payload);
              }
            } catch (_) {}
          } else if (msg.channel === 'ticket_comments') {
            try {
              const payload = JSON.parse(msg.payload);
              // Enrich with author details (name/email) for accurate display on clients
              let authorName = null;
              let authorEmail = null;
              if (payload && payload.user_id) {
                try {
                  const result = await pool.query(
                    `SELECT u.email AS author_email,
                            TRIM(CONCAT(COALESCE(pi.first_name, ''), ' ', COALESCE(pi.last_name, ''))) AS author_name
                     FROM users u
                     LEFT JOIN personal_info pi ON pi.user_id = u.id
                     WHERE u.id = $1
                     LIMIT 1`,
                    [payload.user_id]
                  );
                  if (result.rows && result.rows[0]) {
                    authorEmail = result.rows[0].author_email || null;
                    authorName = (result.rows[0].author_name || '').trim() || null;
                  }
                } catch (_) {}
              }

              const enriched = { ...payload, authorName, authorEmail };
              // Forward to client; page can filter by ticket id
              socket.emit('ticket-comment', enriched);
            } catch (_) {}
          }
        };
        
        client.on('notification', onNotify);
        
        // Properly clean up the client when socket disconnects
        socket.on('disconnect', () => {
          try {
            client.removeListener('notification', onNotify);
            client.release();
            console.log(`🔌 Released database client for socket ${socket.id}`);
          } catch (error) {
            console.error(`❌ Error releasing database client for socket ${socket.id}:`, error.message);
          }
        });
        
        // Also clean up on socket error
        socket.on('error', () => {
          try {
            client.removeListener('notification', onNotify);
            client.release();
            console.log(`🔌 Released database client for socket ${socket.id} due to error`);
          } catch (error) {
            console.error(`❌ Error releasing database client for socket ${socket.id}:`, error.message);
          }
        });
        
      } catch (err) {
        console.error('Failed to LISTEN notifications:', err.message);
      }

      // Also send a timer update to ensure client has latest data
      socket.emit('timerUpdated', timerData);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed: ' + error.message });
    }
  });

  // Global Postgres listener to forward task activity events to all clients
  try {
    if (!global.__sa_task_activity_listener) {
      pool.connect().then((client) => {
        console.log('🔌 Global task activity listener connected');
        
        const handleNotification = (msg) => {
          if (msg.channel === 'task_activity_events') {
            try {
              io.emit('task_activity_event', msg.payload);
            } catch (_) {}
          } else if (msg.channel === 'task_updates') {
            try {
              // Since task groups are now global and users can see tasks they're assigned to,
              // broadcast task updates to all users instead of scoping to task owner only
              io.emit('task_updated', msg.payload);
            } catch (_) {}
          } else if (
            msg.channel === 'task_relations' ||
            msg.channel === 'task_groups' ||
            msg.channel === 'task_custom_fields' ||
            msg.channel === 'task_attachments' ||
            msg.channel === 'task_assignees' ||
            msg.channel === 'task_comments'
          ) {
            try {
              // Since task_groups are now global (no user_id), broadcast to all users
              if (msg.channel === 'task_groups') {
                io.emit('task_groups', msg.payload);
                return;
              }
              io.emit(msg.channel, msg.payload);
            } catch (_) {}
          }
        };
        
        client.on('notification', handleNotification);
        
        // Set up all the LISTEN commands
        const listenChannels = [
          'task_activity_events',
          'task_updates', 
          'task_relations',
          'task_groups',
          'task_custom_fields',
          'task_attachments',
          'task_assignees',
          'task_comments'
        ];
        
        // Listen to all channels
        listenChannels.forEach(channel => {
          client.query(`LISTEN ${channel}`).catch(err => {
            console.error(`❌ Failed to LISTEN to ${channel}:`, err.message);
          });
        });
        
        global.__sa_task_activity_listener = true;
        
        // Handle client errors and cleanup
        client.on('error', (err) => {
          console.error('❌ Global task activity listener error:', err.message);
          // Try to reconnect after a delay
          setTimeout(() => {
            try {
              client.release();
              global.__sa_task_activity_listener = false;
              console.log('🔄 Global task activity listener will reconnect on next request');
            } catch (_) {}
          }, 5000);
        });
        
        // Handle client end
        client.on('end', () => {
          console.log('🔌 Global task activity listener disconnected');
          global.__sa_task_activity_listener = false;
        });
        
      }).catch((err) => {
        console.error('❌ Failed to connect global task activity listener:', err.message);
        global.__sa_task_activity_listener = false;
      });
    }
  } catch (err) {
    console.error('❌ Error setting up global task activity listener:', err.message);
  }

  // Handle activity state changes
  socket.on('activityChange', async (isActive) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      // Update in-memory data
      const userInfo = userData.userInfo;
      userInfo.isActive = isActive;
      if (isActive) {
        userInfo.sessionStart = new Date().toISOString();
      }
      
      // Broadcast to all clients
      io.emit('activityUpdated', {
        userId: userData.userId,
        email: userData.email,
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      });

    } catch (error) {
      console.error('Activity change error:', error);
    }
  });

  // Force shift reset on demand (client-triggered when countdown reaches zero)
  socket.on('forceShiftReset', async () => {
    try {
      const userDataEntry = connectedUsers.get(socket.id);
      if (!userDataEntry) return;
      const email = userDataEntry.email;
      const userInfo = userDataEntry.userInfo;
      const userId = userInfo.userId;
      const shiftInfo = userShiftInfo.get(email) || null;
      const currentDate = new Date().toISOString().split('T')[0]; // Use UTC date for consistency
      const currentShiftId = shiftInfo ? getCurrentShiftId(new Date(), shiftInfo) : currentDate;

      // Debounce on server side too
      if (userInfo.lastResetAt && (Date.now() - userInfo.lastResetAt) < 120000) {
        return;
      }

      // Reset in-memory but preserve current activity state
      const preserveActive = !!userInfo.isActive;
      userInfo.activeSeconds = 0;
      userInfo.inactiveSeconds = 0;
      userInfo.isActive = preserveActive;
      userInfo.sessionStart = new Date().toISOString();
      userInfo.lastResetAt = Date.now();
      userInfo.lastShiftId = currentShiftId;

      // Guard: only allow if we've actually crossed into the next shift window
      const now = new Date();
      const shiftInfoGuard = userShiftInfo.get(email) || null;
      if (shiftInfoGuard) {
        const startBoundary = getShiftStartForDate(now, shiftInfoGuard);
        const lastSessionStart = new Date(userInfo.sessionStart);
        if (!(lastSessionStart < startBoundary && now >= startBoundary)) {
          return; // ignore spurious client reset requests
        }
      }

      // Upsert DB row for today to zero
      await pool.query(
        `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at)
         VALUES ($1, $4, 0, 0, $2, $3, NOW())
         ON CONFLICT (user_id, today_date)
         DO UPDATE SET
           is_currently_active = EXCLUDED.is_currently_active,
           today_active_seconds = 0,
           today_inactive_seconds = 0,
           last_session_start = EXCLUDED.last_session_start,
           updated_at = NOW()`,
        [userId, userInfo.sessionStart, currentDate, preserveActive]
      );

      // Notify all user sockets
      const sockets = userConnections.get(email);
      if (sockets) {
        const resetData = {
          userId,
          email,
          isActive: preserveActive,
          activeSeconds: userInfo.activeSeconds,
          inactiveSeconds: userInfo.inactiveSeconds,
          sessionStart: userInfo.sessionStart,
          resetReason: 'client_forced',
          shiftId: currentShiftId
        };
        sockets.forEach(id => {
          io.to(id).emit('shiftReset', resetData);
          io.to(id).emit('timerUpdated', resetData);
        });
      }
    } catch (e) {
      console.error('forceShiftReset error:', e);
    }
  });

  // Handle timer updates (every 5 seconds from frontend)
  socket.on('timerUpdate', async (timerData) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      // Update in-memory data with frontend values
      const userInfo = userData.userInfo;
      userInfo.activeSeconds = timerData.activeSeconds;
      userInfo.inactiveSeconds = timerData.inactiveSeconds;
      
      // Also try to update database if connection is available
      try {
        // Get or create user in database
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userData.email]);
        let userId;
        
        if (userResult.rows.length === 0) {
          const newUserResult = await pool.query('INSERT INTO users (email) VALUES ($1) RETURNING id', [userData.email]);
          userId = newUserResult.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
        }

        // Get current date in Philippines timezone
        const currentDate = new Date().toISOString().split('T')[0]; // Use UTC date for consistency
        
        // Update activity data in database with daily tracking (Philippines timezone)
        // Guard: do NOT update during the 2s immediately following a server-side reset broadcast
        if (userInfo.lastResetAt && (Date.now() - userInfo.lastResetAt) < 2000) {
          return; // avoid a race that could re-insert pre-reset counters
        }
        // Ensure values only increase (monotonic) to prevent decreasing timer values
        await pool.query(
          `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (user_id, today_date) 
           DO UPDATE SET 
             is_currently_active = $2,
             today_active_seconds = GREATEST(activity_data.today_active_seconds, $3),
             today_inactive_seconds = GREATEST(activity_data.today_inactive_seconds, $4),
             last_session_start = COALESCE($5, activity_data.last_session_start),
             updated_at = NOW()`,
          [userId, userInfo.isActive, userInfo.activeSeconds, userInfo.inactiveSeconds, userInfo.sessionStart, currentDate]
        );
        
        console.log(`💾 Updated timer for ${userData.email}: Active=${userInfo.activeSeconds}s, Inactive=${userInfo.inactiveSeconds}s`);
        
        // Database save successful
      } catch (dbError) {
        console.error('Database update failed:', dbError.message);
      }
      
      // Broadcast to all clients
      io.emit('timerUpdated', {
        userId: userData.userId,
        email: userData.email,
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      });

    } catch (error) {
      console.error('Timer update error:', error);
    }
  });

  // Handle meeting status updates
  socket.on('updateMeetingStatus', async (isInMeeting) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      userMeetingStatus.set(userData.email, isInMeeting);
      console.log(`Meeting status updated for ${userData.email}: ${isInMeeting ? 'In Meeting' : 'Not in Meeting'}`);
      
      // Broadcast to all user connections
      broadcastMeetingStatus(userData.email, isInMeeting);
      
    } catch (error) {
      console.error('Meeting status update error:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.id}, Reason: ${reason}`);
    
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      const email = userData.email;
      
      // Remove from user connections tracking
      if (userConnections.has(email)) {
        userConnections.get(email).delete(socket.id);
        console.log(`User ${email} disconnected. Remaining connections: ${userConnections.get(email).size}`);
        
        // If no more connections for this user, keep data for 60 seconds
        if (userConnections.get(email).size === 0) {
          console.log(`No more connections for ${email}, keeping data for 60 seconds`);
          setTimeout(() => {
            if (userConnections.has(email) && userConnections.get(email).size === 0) {
              console.log(`Removing user data for ${email} after 60 seconds`);
              userConnections.delete(email);
            }
          }, 60000); // Keep for 60 seconds
        }
      }
      
      // Remove from connected users
      connectedUsers.delete(socket.id);
    }
  });

  // Handle reconnection
  socket.on('reconnect', () => {
    console.log(`User reconnected: ${socket.id}`);
  });

  // Task Activity Events
  socket.on('taskMoved', (data) => {
    const { email, taskId, newGroupId, task } = data;
    console.log('Socket server received taskMoved:', { email, taskId, newGroupId, task });
    // Broadcast to all users in the same task activity room
    io.to(`task-activity-${email}`).emit('taskMoved', { taskId, newGroupId, task });
    console.log(`Broadcasting taskMoved to room: task-activity-${email}`);
  });

  socket.on('taskCreated', (data) => {
    const { email, groupId, task } = data;
    // Broadcast to all users in the same task activity room
    io.to(`task-activity-${email}`).emit('taskCreated', { groupId, task });
  });

  socket.on('groupCreated', (data) => {
    const { email, group } = data;
    // Broadcast to all users in the same task activity room
    io.to(`task-activity-${email}`).emit('groupCreated', { group });
  });

  socket.on('groupsReordered', (data) => {
    const { email, groupPositions } = data;
    console.log('Socket server received groupsReordered:', { email, groupPositions });
    // Broadcast to all users in the same task activity room
    io.to(`task-activity-${email}`).emit('groupsReordered', { groupPositions });
    console.log(`Broadcasting groupsReordered to room: task-activity-${email}`);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 

// Start real-time shift reset monitoring
const shiftResetInterval = setInterval(async () => {
  try {
    console.log(`🔄 Shift reset monitoring cycle - checking ${userData.size} users`);
    
    // Check all connected users for shift resets
    for (const [email, userInfo] of userData.entries()) {
      if (userInfo.userId) {
        try {
          const resetResult = await checkShiftReset(email, userInfo.userId);
          if (resetResult) {
            console.log(`✅ Shift reset completed for ${email}`);
          }
          
          // Also check break availability windows
          const shiftInfo = userShiftInfo.get(email);
          if (shiftInfo) {
          }
        } catch (userError) {
          console.error(`❌ Error checking shift reset for ${email}:`, userError.message);
          // Continue with other users instead of failing the entire cycle
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in shift reset monitoring:', error);
  }
}, 30000); // Check every 30 seconds instead of 60 seconds for faster response

// Add an additional quick check every 10 seconds for critical timing
const quickShiftResetInterval = setInterval(async () => {
  try {
    // Only do a quick check if there are active users
    if (userData.size > 0) {
      for (const [email, userInfo] of userData.entries()) {
        if (userInfo.userId && userInfo.lastResetAt) {
          // Check if we're within 5 minutes of expected reset time
          const shiftInfo = userShiftInfo.get(email);
          if (shiftInfo) {
            const currentTime = new Date();
            const timeUntilReset = getTimeUntilNextReset(currentTime, shiftInfo);
            
            // If we're within 5 minutes of reset, check more frequently
            if (timeUntilReset <= 300000 && timeUntilReset > 0) { // 5 minutes in milliseconds
              try {
                await checkShiftReset(email, userInfo.userId);
              } catch (userError) {
                // Silent error for quick checks
              }
            }
            
            // If we're within 30 seconds of reset, check even more aggressively
            if (timeUntilReset <= 30000 && timeUntilReset > 0) { // 30 seconds
              console.log(`⏰ Critical timing: ${email} reset in ${Math.floor(timeUntilReset/1000)}s - forcing immediate check`);
              try {
                await checkShiftReset(email, userInfo.userId);
              } catch (userError) {
                console.error(`❌ Critical timing check failed for ${email}:`, userError.message);
              }
            }
            
            // If we're within 10 seconds of reset, check every second
            if (timeUntilReset <= 10000 && timeUntilReset > 0) { // 10 seconds
              console.log(`🚨 Ultra-critical timing: ${email} reset in ${Math.floor(timeUntilReset/1000)}s - checking every second`);
              try {
                await checkShiftReset(email, userInfo.userId);
              } catch (userError) {
                console.error(`❌ Ultra-critical timing check failed for ${email}:`, userError.message);
              }
            }
            
            // If we're within 5 seconds of reset, check every 500ms
            if (timeUntilReset <= 5000 && timeUntilReset > 0) { // 5 seconds
              console.log(`💥 Final countdown: ${email} reset in ${Math.floor(timeUntilReset/1000)}s - checking every 500ms`);
              try {
                await checkShiftReset(email, userInfo.userId);
              } catch (userError) {
                console.error(`❌ Final countdown check failed for ${email}:`, userError.message);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Silent error for quick checks
  }
}, 10000); // Check every 10 seconds

// Add ultra-fast check for final seconds
const ultraFastShiftResetInterval = setInterval(async () => {
  try {
    if (userData.size > 0) {
      for (const [email, userInfo] of userData.entries()) {
        if (userInfo.userId && userInfo.lastResetAt) {
          const shiftInfo = userShiftInfo.get(email);
          if (shiftInfo) {
            const currentTime = new Date();
            const timeUntilReset = getTimeUntilNextReset(currentTime, shiftInfo);
            
            // Only check if we're within 5 seconds of reset
            if (timeUntilReset <= 5000 && timeUntilReset > 0) {
              try {
                await checkShiftReset(email, userInfo.userId);
              } catch (userError) {
                // Silent error for ultra-fast checks
              }
            }
          }
        }
      }
    }
  } catch (error) {
    // Silent error for ultra-fast checks
  }
}, 500); // Check every 500ms

// Cleanup interval on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down shift reset monitoring...');
  clearInterval(shiftResetInterval);
  clearInterval(quickShiftResetInterval); // Also clear the quick check interval
  clearInterval(ultraFastShiftResetInterval); // Also clear the ultra-fast interval
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down shift reset monitoring...');
  clearInterval(shiftResetInterval);
  clearInterval(quickShiftResetInterval); // Also clear the quick check interval
  clearInterval(ultraFastShiftResetInterval); // Also clear the ultra-fast interval
  process.exit(0);
}); 