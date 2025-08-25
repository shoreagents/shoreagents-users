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

// Initialize global notification listener
let globalNotificationClient = null;
let globalNotificationRetryInterval = null;

async function initializeGlobalNotificationListener() {
  try {
    if (globalNotificationClient) {
      globalNotificationClient.release();
    }
    
    globalNotificationClient = await pool.connect();
    await globalNotificationClient.query('LISTEN notifications');
    await globalNotificationClient.query('LISTEN ticket_comments');
    await globalNotificationClient.query('LISTEN weekly_activity_change');
    await globalNotificationClient.query('LISTEN monthly_activity_change');
    
    console.log('📡 Global notification listener initialized');
    
    globalNotificationClient.on('notification', async (msg) => {
      try {
        // Only log raw notifications for debugging specific channels if needed
        if (msg.channel !== 'weekly_activity_change' && msg.channel !== 'monthly_activity_change') {
          console.log(`🔔 Raw notification received on channel '${msg.channel}' with payload:`, msg.payload);
        }
        if (msg.channel === 'notifications') {
          const payload = JSON.parse(msg.payload);
          console.log(`📡 Global notification received for user ${payload.user_id}:`, payload.title);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            console.log(`🔍 Looking for user ${payload.user_id} in ${connectedUsers.size} connected users`);
            console.log(`🔍 Connected users:`, Array.from(connectedUsers.entries()).map(([id, data]) => `${id}: ${data.email} (userId: ${data.userId})`));
            
            // Find the user's email by looking through all connected users
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (userData.userId === payload.user_id) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              const userSockets = userConnections.get(targetEmail);
              if (userSockets && userSockets.size > 0) {
                console.log(`📤 Broadcasting notification to ${userSockets.size} connections for user ${payload.user_id} (${targetEmail})`);
                userSockets.forEach(socketId => {
                  io.to(socketId).emit('db-notification', payload);
                });
              } else {
                console.log(`⚠️ No active connections found for user ${payload.user_id} (${targetEmail})`);
              }
            } else {
              console.log(`⚠️ User ${payload.user_id} not found in connected users`);
            }
          }
        } else if (msg.channel === 'ticket_comments') {
          const payload = JSON.parse(msg.payload);
          console.log(`📡 Global ticket comment notification received for user ${payload.user_id}`);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (userData.userId === payload.user_id) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              const userSockets = userConnections.get(targetEmail);
              if (userSockets && userSockets.size > 0) {
                userSockets.forEach(socketId => {
                  io.to(socketId).emit('ticket-comment', payload);
                });
              }
            }
          }
        } else if (msg.channel === 'weekly_activity_change') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (userData.userId === payload.user_id) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              const userSockets = userConnections.get(targetEmail);
              if (userSockets && userSockets.size > 0) {
                userSockets.forEach(socketId => {
                  io.to(socketId).emit('weekly-activity-update', payload);
                });
              }
            }
          }
        } else if (msg.channel === 'monthly_activity_change') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (userData.userId === payload.user_id) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              const userSockets = userConnections.get(targetEmail);
              if (userSockets && userSockets.size > 0) {
                userSockets.forEach(socketId => {
                  io.to(socketId).emit('monthly-activity-update', payload);
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error handling global notification:', error.message);
      }
    });
    
    globalNotificationClient.on('error', (error) => {
      console.error('❌ Global notification client error:', error.message);
      scheduleGlobalNotificationRetry();
    });
    
    globalNotificationClient.on('end', () => {
      console.log('🔌 Global notification client disconnected');
      scheduleGlobalNotificationRetry();
    });
    
    // Clear any existing retry interval
    if (globalNotificationRetryInterval) {
      clearInterval(globalNotificationRetryInterval);
      globalNotificationRetryInterval = null;
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize global notification listener:', error.message);
    scheduleGlobalNotificationRetry();
  }
}

function scheduleGlobalNotificationRetry() {
  if (globalNotificationRetryInterval) {
    clearInterval(globalNotificationRetryInterval);
  }
  
  console.log('🔄 Scheduling global notification listener retry in 5 seconds...');
  globalNotificationRetryInterval = setInterval(() => {
    console.log('🔄 Retrying global notification listener...');
    initializeGlobalNotificationListener();
  }, 5000);
}

// Start global notification listener
initializeGlobalNotificationListener();

// Monitor global notification listener health
setInterval(() => {
  if (globalNotificationClient && globalNotificationClient.connection) {
    const status = globalNotificationClient.connection.stream.readyState;
    if (status === 'closed' || status === 'closing') {
      console.log('⚠️ Global notification client connection is closed, reconnecting...');
      initializeGlobalNotificationListener();
    }
  }
}, 30000); // Check every 30 seconds

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

// Track user connections and online status
// REMOVED: Online status tracking functionality

// Initialize with test data
userData.set('bob@example.com', {
  userId: 1,
  isActive: false,
  activeSeconds: 0,
  inactiveSeconds: 0,
  sessionStart: new Date().toISOString()
});

// Keep track of active connections per user
const userConnections = new Map(); // Map<email, Set<socketId>>

// Track user online/offline status (based on login/logout, not socket connections)
const userStatus = new Map(); // Map<email, { status: 'online'|'offline', loginTime: Date, lastSeen: Date }>

// Track ongoing authentication processes to prevent duplicates
const authenticationInProgress = new Map(); // Map<email, Promise>

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

  try {
    if (shiftInfo.isNightShift) {
      // NIGHT SHIFT LOGIC: Only reset when we start a completely new night shift
      // A night shift continues until the end time (7 AM), then resets at the next start time (10 PM)
      
      // Get the current shift start time (when the current night shift started)
      const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
      
      // Get the last shift start time (when the last recorded activity's night shift started)
      const lastShiftStart = getShiftStartForDate(lastActivityTime, shiftInfo);
      
      // For night shifts, we only reset when we move to a completely new night shift period
      // This means the last activity was from a different night shift start time
      const shouldReset = lastShiftStart.getTime() !== currentShiftStart.getTime();
      
      console.log(`🕐 Night Shift reset check:`, {
        lastActivity: lastActivityTime.toISOString(),
        currentTime: currentTime.toISOString(),
        lastShiftStart: lastShiftStart.toISOString(),
        currentShiftStart: currentShiftStart.toISOString(),
        shouldReset: shouldReset,
        reason: shouldReset ? 'new_night_shift_period' : 'same_night_shift_period'
      });
      
      return shouldReset;
    } else {
      // DAY SHIFT LOGIC: Reset daily at shift start time
      // Compute the start boundary for the shift window that the CURRENT time belongs to
      const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
      
      // Add debug logging
      console.log(`🕐 Day Shift reset check for ${shiftInfo.period}:`, {
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
  } catch (error) {
    console.error('Error in shouldResetForShift:', error);
    // Fallback to daily reset on error
    const lastDate = lastActivityTime.toISOString().split('T')[0];
    const currentDate = currentTime.toISOString().split('T')[0];
    return lastDate !== currentDate;
  }
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

  try {
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
  } catch (error) {
    console.error('Error calculating next shift start:', error);
    // Fallback to next day at midnight
    const fallback = new Date(currentTime);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
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

// Function to get user information including name from database
async function getUserInfo(userId) {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        COALESCE(
          CONCAT(
            pi.first_name, 
            CASE WHEN pi.middle_name IS NOT NULL AND pi.middle_name != '' THEN ' ' || pi.middle_name ELSE '' END,
            ' ' || pi.last_name
          ),
          u.email
        ) as full_name
      FROM users u
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      WHERE u.id = $1
    `, [userId]);
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    return null;
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Function to initialize user status for all team members
async function initializeTeamUserStatus(referenceMemberId) {
  try {
    console.log(`🔍 Initializing user status for team ${referenceMemberId}...`);
    
    // Fetch all team members from database
    const teamQuery = `
      SELECT 
        u.id,
        u.email,
        TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as full_name
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      WHERE a.member_id = $1
      ORDER BY u.email
    `;
    
    const teamResult = await pool.query(teamQuery, [referenceMemberId]);
    console.log(`📋 Found ${teamResult.rows.length} team members to initialize`);
    
    // Initialize userStatus for all team members (default to offline)
    for (const row of teamResult.rows) {
      const email = row.email;
      if (!userStatus.has(email)) {
        userStatus.set(email, {
          status: 'offline',
          loginTime: null,
          lastSeen: null
        });
        console.log(`⏸️ Initialized offline status for: ${email}`);
      }
    }
    
    console.log(`✅ Team user status initialization completed for ${teamResult.rows.length} members`);
  } catch (error) {
    console.error('❌ Error initializing team user status:', error);
  }
}

// Function to get all connected users with their status
async function getConnectedUsersList() {
  try {
    console.log('🔍 Fetching connected users list...');
    
    // Get all users from the database who are part of the same team
    // First, we need to get a reference user to determine the team
    let referenceUser = null;
    let referenceMemberId = null;
    
    // Find any authenticated user to get their member_id
    for (const [email, status] of userStatus.entries()) {
      if (status.status === 'online') {
        const userDataEntry = userData.get(email);
        if (userDataEntry && userDataEntry.userId) {
          referenceUser = userDataEntry;
          break;
        }
      }
    }
    
    if (!referenceUser) {
      console.log('⚠️ No reference user found, returning empty list');
      return [];
    }
    
    // Get the member_id for the reference user
    try {
      const memberQuery = `
        SELECT a.member_id
        FROM agents a
        WHERE a.user_id = $1
        LIMIT 1
      `;
      const memberResult = await pool.query(memberQuery, [referenceUser.userId]);
      
      if (memberResult.rows.length === 0) {
        console.log('⚠️ Reference user is not an agent, returning empty list');
        return [];
      }
      
             referenceMemberId = memberResult.rows[0].member_id;
       console.log(`🔍 Found reference member_id: ${referenceMemberId}`);
       
       // Initialize user status for all team members
       await initializeTeamUserStatus(referenceMemberId);
     } catch (error) {
       console.error('❌ Error getting reference member_id:', error);
       return [];
     }
    
    // Now fetch all agents from the same team
    const teamQuery = `
      SELECT 
        u.id,
        u.email,
        TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as full_name,
        a.member_id
      FROM users u
      INNER JOIN agents a ON u.id = a.user_id
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      WHERE a.member_id = $1
      ORDER BY u.email
    `;
    
    const teamResult = await pool.query(teamQuery, [referenceMemberId]);
    console.log(`📋 Found ${teamResult.rows.length} team members in database`);
    
    const users = [];
    
    // Process each team member
    for (const row of teamResult.rows) {
      const email = row.email;
      const userId = row.id;
      const fullName = row.full_name || email;
      
      // Check if this user has socket status
      const socketStatus = userStatus.get(email);
      const userDataEntry = userData.get(email);
      
      if (socketStatus) {
        // User has socket status - use it
        users.push({
          id: userId,
          email: email,
          name: fullName,
          status: socketStatus.status,
          lastSeen: socketStatus.lastSeen?.toISOString(),
          loginTime: socketStatus.loginTime?.toISOString()
        });
        console.log(`✅ User ${email} has socket status: ${socketStatus.status}`);
      } else {
        // User doesn't have socket status - mark as offline
        users.push({
          id: userId,
          email: email,
          name: fullName,
          status: 'offline',
          lastSeen: null,
          loginTime: null
        });
        console.log(`⏸️ User ${email} has no socket status - marked as offline`);
      }
    }
    
    console.log(`📋 Returning ${users.length} users for team ${referenceMemberId}`);
    return users;
    
  } catch (error) {
    console.error('❌ Error in getConnectedUsersList:', error);
    return [];
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
    
    // FIXED: Use lastShiftBoundaryTime instead of sessionStart for shift reset logic
    // This ensures we track when the user last crossed a shift boundary, not when they were last active
    const lastShiftBoundaryTime = userInfo.lastShiftBoundaryTime ? new Date(userInfo.lastShiftBoundaryTime) : new Date(userInfo.sessionStart);
    
    // Check if we should reset based on shift schedule
    const shouldReset = shouldResetForShift(lastShiftBoundaryTime, currentTime, shiftInfo);
    
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
      // FIXED: Update lastShiftBoundaryTime to current time when reset occurs
      userInfo.lastShiftBoundaryTime = currentTime.toISOString();
      userInfo.lastResetAt = Date.now();
      userInfo.lastShiftId = currentShiftId;
      
      // Get current date in Philippines timezone
      // For night shifts, use the date when the shift started (not current calendar date)
      let currentDate;
      if (shiftInfo && shiftInfo.isNightShift) {
        // For night shifts, use the date when the current shift started
        const shiftStartDate = getShiftStartForDate(currentTime, shiftInfo);
        currentDate = shiftStartDate.toISOString().split('T')[0];
        console.log(`🌙 Night shift detected for ${email} - using shift start date: ${currentDate} (not current calendar date)`);
      } else {
        // For day shifts, use current calendar date
        currentDate = new Date().toISOString().split('T')[0];
      }
      
      try {
        // Reset today's row in DB - create new row for new shift period
        try {
          await pool.query(
            `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at)
             VALUES ($1, $4, 0, 0, $2, $3, NOW())`,
            [userId, userInfo.sessionStart, currentDate, preserveActive]
          );
        } catch (insertError) {
          // If insert fails due to conflict, it means a row already exists for this date
          if (insertError.code === '23505') { // Unique constraint violation
            console.log(`📊 Activity record already exists for ${email} on ${currentDate} during shift reset - updating instead`);
            await pool.query(
              `UPDATE activity_data 
               SET is_currently_active = $1, 
                   today_active_seconds = 0, 
                   today_inactive_seconds = 0, 
                   last_session_start = $2, 
                   updated_at = NOW()
               WHERE user_id = $3 AND today_date = $4`,
              [preserveActive, userInfo.sessionStart, userId, currentDate]
            );
          } else {
            throw insertError; // Re-throw other errors
          }
        }
      } catch (dbError) {
        console.error(`Database error during shift reset for ${email}:`, dbError);
        // Continue with in-memory reset even if DB fails
      }
      
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
  if (!date || !shiftInfo || !shiftInfo.startTime) {
    console.error('Invalid parameters for getShiftStartForDate:', { date, shiftInfo });
    // Return a safe fallback
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  try {
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
  } catch (error) {
    console.error('Error in getShiftStartForDate:', error);
    // Return a safe fallback
    const fallback = new Date();
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

// Function to get current shift ID
function getCurrentShiftId(currentTime, shiftInfo) {
  if (!shiftInfo) {
    // Fallback to date-based ID using UTC
    return currentTime.toISOString().split('T')[0];
  }

  try {
    const shiftStart = getShiftStartForDate(currentTime, shiftInfo);
    
    if (shiftInfo.isNightShift) {
      // For night shifts, use the date when the shift started
      return shiftStart.toISOString().split('T')[0] + '-night';
    } else {
      // For day shifts, use the current date
      return currentTime.toISOString().split('T')[0] + '-day';
    }
  } catch (error) {
    console.error('Error calculating current shift ID:', error);
    // Fallback to date-based ID
    return currentTime.toISOString().split('T')[0];
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

  try {
    const nextShiftStart = getNextShiftStart(currentTime, shiftInfo);
    return nextShiftStart.getTime() - currentTime.getTime();
  } catch (error) {
    console.error('Error calculating time until next reset:', error);
    // Fallback to 24 hours if calculation fails
    return 24 * 60 * 60 * 1000;
  }
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

  // Helper: precreate next-day row if shift already ended (Manila)
  async function precreateNextDayRowIfEnded(userId) {
    try {
      const res = await pool.query(
        `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
        [userId]
      );
      const shiftText = (res.rows[0]?.shift_time || '').toString();
      const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      if (!both) return; // no shift configured

      const parseToMinutes = (token) => {
        const [hhmm, ampm] = token.trim().toUpperCase().split(/\s+/);
        const [hhStr, mmStr] = hhmm.split(':');
        let hh = parseInt(hhStr, 10);
        const mm = parseInt(mmStr, 10);
        if (ampm === 'AM') { if (hh === 12) hh = 0; } else { if (hh !== 12) hh += 12; }
        return (hh * 60) + mm;
      };
      const startMinutes = parseToMinutes(both[1]);
      const endMinutes = parseToMinutes(both[2]);
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const nowMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
      const isDayShift = endMinutes > startMinutes;

      // Determine if shift has ended relative to "today"
      let ended = false;
      if (isDayShift) {
        ended = nowMinutes >= endMinutes;
      } else {
        // night shift, end in morning
        ended = nowMinutes >= endMinutes && nowMinutes < startMinutes;
      }
      if (!ended) return;

      // Compute next Manila date string YYYY-MM-DD
      const next = new Date(nowPH); next.setDate(next.getDate() + 1);
      const y = next.getFullYear(); const m = String(next.getMonth()+1).padStart(2,'0'); const d = String(next.getDate()).padStart(2,'0');
      const nextDate = `${y}-${m}-${d}`;

      await pool.query(
        `INSERT INTO activity_data (user_id, is_currently_active, last_session_start, today_date, today_active_seconds, today_inactive_seconds, updated_at)
         VALUES ($1, FALSE, NULL, $2, 0, 0, NOW())
         ON CONFLICT (user_id, today_date) DO NOTHING`,
        [userId, nextDate]
      );
    } catch (_) {}
  }

      // Handle user authentication
   socket.on('authenticate', async (data) => {
      const startTime = Date.now();
      console.log(`🔐 AUTHENTICATE EVENT RECEIVED from socket ${socket.id}:`, data);
      
      try {
        
       // Handle both object format { email } and direct email string
       const email = typeof data === 'string' ? data : data?.email;
       
       if (!email || typeof email !== 'string') {
         console.log('❌ Authentication failed: Invalid email format');
         socket.emit('error', { message: 'Valid email string is required' });
         return;
       }
       
       console.log(`🔐 Authenticating user with email: ${email}`);
      
      // Get or create user data
      const emailString = String(email);
      
      // Check if authentication is already in progress for this user
      if (authenticationInProgress.has(emailString)) {
        console.log(`⏳ Authentication already in progress for: ${emailString}, waiting...`);
        try {
          await authenticationInProgress.get(emailString);
          // After waiting, get the user data and send response
          const userInfo = userData.get(emailString);
          if (userInfo) {
            // Add this socket to connectedUsers map
            connectedUsers.set(socket.id, { userId: userInfo.userId, email: emailString, userInfo });
            console.log(`🔐 AUTHENTICATION COMPLETED (waited): Socket ${socket.id} now associated with user ${emailString}`);
            // User data retrieved after waiting
            
            const initialTimerData = {
              userId: userInfo.userId, // Include userId in authenticated response
              isActive: userInfo.isActive,
              activeSeconds: userInfo.activeSeconds,
              inactiveSeconds: userInfo.inactiveSeconds,
              sessionStart: userInfo.sessionStart
            };
            socket.emit('authenticated', initialTimerData);
            console.log(`✅ Authentication completed (waited) for ${emailString}`);
          }
        } catch (error) {
          console.log(`❌ Authentication wait failed for ${emailString}:`, error.message);
          socket.emit('error', { message: 'Authentication failed' });
        }
        return;
      }
      
      // Create a promise that will be resolved when authentication completes
      let resolveAuth, rejectAuth;
      const authPromise = new Promise((resolve, reject) => {
        resolveAuth = resolve;
        rejectAuth = reject;
      });
      
      // Mark authentication as in progress
      authenticationInProgress.set(emailString, authPromise);
      
      // Set timeout to reject the promise if it takes too long
      const authTimeout = setTimeout(() => {
        console.error(`⏰ Authentication timeout for ${emailString} - cleaning up`);
        rejectAuth(new Error('Authentication timeout'));
        authenticationInProgress.delete(emailString);
        socket.emit('error', { message: 'Authentication timeout' });
      }, 10000); // 10 second timeout
      
      console.log(`🔍 Looking up user data for: ${emailString}`);
      let userInfo = userData.get(emailString);
      if (!userInfo) {
        console.log(`📝 Creating new user data for: ${emailString}`);
        // Creating new user data;
        userInfo = {
          userId: null, // Will be set after database lookup
          isActive: false,
          activeSeconds: 0,
          inactiveSeconds: 0,
          sessionStart: new Date().toISOString(),
          lastShiftBoundaryTime: new Date().toISOString(), // FIXED: Track when user last crossed shift boundary
          lastResetAt: null,
          lastShiftId: null,
          lastDbUpdate: 0, // Initialize database update throttling
          lastSocketEmit: 0, // Initialize socket emission throttling
          lastActivityEmit: 0 // Initialize activity emission throttling
        };
        // New userInfo object created
        
        // Try to load existing data from database
        console.log(`🔍 Checking database for user: ${emailString}`);
        try {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [emailString]);
          let userId;
          
                     if (userResult.rows.length === 0) {
             const newUserResult = await pool.query('INSERT INTO users (email, user_type) VALUES ($1, $2) RETURNING id', [emailString, 'Agent']);
             userId = newUserResult.rows[0].id;
           } else {
            userId = userResult.rows[0].id;
          }
          
          // Set the user ID to the database ID
          userInfo.userId = userId;
          // User ID set from database
          
          // Get user shift information for shift-based resets
          console.log(`🕐 Getting shift info for user ID: ${userId}`);
          const shiftInfo = await getUserShiftInfo(userId);
          userShiftInfo.set(emailString, shiftInfo);
          
          if (shiftInfo) {
            console.log(`👤 User ${emailString} has ${shiftInfo.period} schedule: ${shiftInfo.time}`);
          }
          
                     // Load activity data from database (shift-aware or daily)
           const currentTime = new Date();
           // For night shifts, use the date when the shift started (not current calendar date)
           let currentDate;
           if (shiftInfo && shiftInfo.isNightShift) {
             // For night shifts, use the date when the current shift started
             const shiftStartDate = getShiftStartForDate(currentTime, shiftInfo);
             currentDate = shiftStartDate.toISOString().split('T')[0];
             console.log(`🌙 Night shift detected for ${emailString} - using shift start date: ${currentDate} (not current calendar date)`);
           } else {
             // For day shifts, use current calendar date
             currentDate = new Date().toISOString().split('T')[0];
           }
          
          // First check if there's any activity data for this user
          console.log(`🔍 Loading activity data for user ${emailString} (ID: ${userId})`);
          const activityResult = await pool.query(
            `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
             FROM activity_data 
             WHERE user_id = $1 
             ORDER BY today_date DESC 
             LIMIT 1`,
            [userId]
          );
          console.log(`📊 Activity query for user ${emailString} (ID: ${userId}) returned ${activityResult.rows.length} rows`);
          
          if (activityResult.rows.length > 0) {
            const dbData = activityResult.rows[0];
            const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            const lastActivityTime = new Date(dbData.last_session_start || dbData.today_date);
            
            console.log(`📅 User ${emailString} (ID: ${userId}) - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
            
            // Check if we should reset based on shift schedule
            const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
            
            if (!shouldReset) {
              // Same shift period - use existing values
              if (shiftInfo) {
                console.log(`✅ Same shift period detected for ${emailString} (${shiftInfo.period}) - loading existing timer data`);
              } else {
                console.log(`✅ Same day detected for ${emailString} - loading existing timer data`);
              }
              userInfo.activeSeconds = dbData.today_active_seconds || 0;
              userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
              userInfo.isActive = dbData.is_currently_active || false;
              userInfo.sessionStart = dbData.last_session_start || new Date().toISOString();
              // FIXED: Initialize lastShiftBoundaryTime for existing users loaded from database
              if (!userInfo.lastShiftBoundaryTime) {
                userInfo.lastShiftBoundaryTime = userInfo.sessionStart;
              }
              
              // Ensure lastDbUpdate field exists for throttling
              if (typeof userInfo.lastDbUpdate === 'undefined') {
                userInfo.lastDbUpdate = 0;
              }
              // Record current shift id to prevent accidental resets later
              if (shiftInfo) {
                userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
              }
              
              // Initialize throttling fields
              userInfo.lastDbUpdate = 0;
              userInfo.lastSocketEmit = 0;
              userInfo.lastActivityEmit = 0;
            } else {
              // New shift period - reset timers
              if (shiftInfo) {
                console.log(`🔄 New shift period detected for ${emailString} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
              } else {
                console.log(`🔄 New day detected for ${emailString} (${dbDate} -> ${currentDate}) - resetting timers`);
              }
              const preserveActive = !!userInfo.isActive;
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = preserveActive;
              userInfo.sessionStart = new Date().toISOString();
              // FIXED: Update lastShiftBoundaryTime when new shift period is detected
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
              
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
              // FIXED: Update lastShiftBoundaryTime when fresh start reset occurs
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
              console.log(`⏰ Fresh start with reset for ${email} - ${resetReason}`);
            } else {
              // Normal fresh start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = false;
              userInfo.sessionStart = new Date().toISOString();
              // FIXED: Update lastShiftBoundaryTime for normal fresh start
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
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
        
        userData.set(emailString, userInfo);
        console.log(`💾 Stored new user data for: ${emailString}`);
      } else {
        console.log(`✅ Found existing user data for: ${emailString}`);
        // Found existing user data;
        // Keep existing timer data - don't reset on reconnection
        // But also try to refresh from database to ensure we have latest data and check for new shift
        console.log(`🔄 Refreshing existing user data from database for: ${emailString}`);
        try {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [emailString]);
          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            console.log(`📊 Database user ID found: ${userId}`);
            
            // Get/refresh user shift information
            console.log(`🕐 Refreshing shift info for user ID: ${userId}`);
            const shiftInfo = await getUserShiftInfo(userId);
            userShiftInfo.set(emailString, shiftInfo);
            console.log(`✅ Shift info refreshed for: ${emailString}`);
            
                         const currentTime = new Date();
             // For night shifts, use the date when the shift started (not current calendar date)
             let currentDate;
             if (shiftInfo && shiftInfo.isNightShift) {
               // For night shifts, use the date when the current shift started
               const shiftStartDate = getShiftStartForDate(currentTime, shiftInfo);
               currentDate = shiftStartDate.toISOString().split('T')[0];
               console.log(`🌙 Night shift refresh detected for ${emailString} - using shift start date: ${currentDate} (not current calendar date)`);
             } else {
               // For day shifts, use current calendar date
               currentDate = new Date().toISOString().split('T')[0];
             }
            
                        // Get the most recent activity data for this user
            console.log(`📊 Loading most recent activity data for user ${emailString} (ID: ${userId})`);
            const activityResult = await pool.query(
              `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
               FROM activity_data 
               WHERE user_id = $1 
               ORDER BY today_date DESC
               LIMIT 1`,
              [userId]
            );
            console.log(`📊 Activity query for user ${emailString} (ID: ${userId}) returned ${activityResult.rows.length} rows`);
            
            if (activityResult.rows.length > 0) {
              const dbData = activityResult.rows[0];
              const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
              const lastActivityTime = new Date(dbData.last_session_start || dbData.today_date);
              
              console.log(`📅 Refresh check for ${emailString} - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
              
              // Check if we should reset based on shift schedule
              const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
              
              if (!shouldReset) {
                // Same shift period - update with database data if it's more recent
                if (dbData.today_active_seconds > userInfo.activeSeconds || dbData.today_inactive_seconds > userInfo.inactiveSeconds) {
                  if (shiftInfo) {
                    console.log(`🔄 Updating memory data for ${emailString} with more recent database data (same shift period: ${shiftInfo.period})`);
                  } else {
                    console.log(`🔄 Updating memory data for ${emailString} with more recent database data`);
                  }
                  userInfo.activeSeconds = dbData.today_active_seconds || 0;
                  userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
                  userInfo.isActive = dbData.is_currently_active || false;
                  userInfo.sessionStart = dbData.last_session_start || userInfo.sessionStart;
                  // FIXED: Initialize lastShiftBoundaryTime for existing users loaded from database
                  if (!userInfo.lastShiftBoundaryTime) {
                    userInfo.lastShiftBoundaryTime = userInfo.sessionStart;
                  }
                  
                  // Ensure lastDbUpdate field exists for throttling
                  if (typeof userInfo.lastDbUpdate === 'undefined') {
                    userInfo.lastDbUpdate = 0;
                  }
                  // Record current shift id to prevent accidental resets later
                  if (shiftInfo) {
                    userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
                  }
                  
                  // Initialize throttling fields
                  userInfo.lastDbUpdate = 0;
                  userInfo.lastSocketEmit = 0;
                  userInfo.lastActivityEmit = 0;
                }
              } else {
              // New shift period - reset for new shift
                if (shiftInfo) {
                  console.log(`🔄 New shift period detected during refresh for ${emailString} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
                } else {
                  console.log(`🔄 New day detected during refresh for ${emailString} (${dbDate} -> ${currentDate}) - resetting timers`);
                }
              const preserveActive = !!userInfo.isActive;
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              userInfo.isActive = preserveActive;
              userInfo.sessionStart = new Date().toISOString();
              // FIXED: Update lastShiftBoundaryTime when new shift period is detected
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastShiftId = getCurrentShiftId(currentTime, shiftInfo);
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
                
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
              // No activity data exists, create fresh record
                              console.log(`🆕 No activity data found during refresh for ${email} - creating fresh start`);
              
              // Ensure throttling fields exist
              if (typeof userInfo.lastDbUpdate === 'undefined') {
                userInfo.lastDbUpdate = 0;
              }
              if (typeof userInfo.lastSocketEmit === 'undefined') {
                userInfo.lastSocketEmit = 0;
              }
              if (typeof userInfo.lastActivityEmit === 'undefined') {
                userInfo.lastActivityEmit = 0;
              }
              
              // Check if we should reset based on shift start time
              let shouldResetForRefresh = false;
              let refreshResetReason = 'fresh_start_refresh';
              
              if (shiftInfo) {
                // Check if current time has passed shift start time today
                const hasShiftStarted = hasShiftStartedToday(currentTime, shiftInfo);
                if (hasShiftStarted) {
                  shouldResetForRefresh = true;
                  refreshResetReason = 'shift_started_refresh';
                  console.log(`🔄 User ${emailString} refreshing after shift start time (${shiftInfo.time}) - resetting timers`);
                }
              }
              
              if (shouldResetForRefresh) {
                // Reset timers for user refreshing after shift start
                userInfo.activeSeconds = 0;
                userInfo.inactiveSeconds = 0;
                userInfo.isActive = false;
                userInfo.sessionStart = new Date().toISOString();
                // FIXED: Update lastShiftBoundaryTime when refresh reset occurs
                userInfo.lastShiftBoundaryTime = currentTime.toISOString();
                userInfo.lastResetAt = Date.now();
                userInfo.lastDbUpdate = 0; // Initialize for throttling
                userInfo.lastSocketEmit = 0; // Initialize for throttling
                userInfo.lastActivityEmit = 0; // Initialize for throttling
                console.log(`⏰ Refresh with reset for ${emailString} - ${refreshResetReason}`);
              } else {
                // Normal fresh start
                const preserveActive = !!userInfo.isActive;
                userInfo.activeSeconds = 0;
                userInfo.inactiveSeconds = 0;
                userInfo.isActive = preserveActive;
                userInfo.sessionStart = new Date().toISOString();
                // FIXED: Update lastShiftBoundaryTime for normal refresh
                userInfo.lastShiftBoundaryTime = currentTime.toISOString();
                userInfo.lastDbUpdate = 0; // Initialize for throttling
                userInfo.lastSocketEmit = 0; // Initialize for throttling
                userInfo.lastActivityEmit = 0; // Initialize for throttling
                console.log(`🆕 Refresh fresh start for ${emailString} - no reset needed`);
              }
              
              // Ensure throttling fields exist
              if (typeof userInfo.lastDbUpdate === 'undefined') {
                userInfo.lastDbUpdate = 0;
              }
              if (typeof userInfo.lastSocketEmit === 'undefined') {
                userInfo.lastSocketEmit = 0;
              }
              if (typeof userInfo.lastActivityEmit === 'undefined') {
                userInfo.lastActivityEmit = 0;
              }
              
                 try {
                   await pool.query(
                    `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
                       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                       [userId, preserveActive, 0, 0, userInfo.sessionStart, currentDate]
                  );
                 } catch (insertError) {
                   // If insert fails due to conflict, it means a row already exists for this date
                   if (insertError.code === '23505') { // Unique constraint violation
                     console.log(`📊 Activity record already exists for ${emailString} on ${currentDate} - updating instead`);
                     await pool.query(
                       `UPDATE activity_data 
                        SET is_currently_active = $1, 
                            today_active_seconds = 0, 
                            today_inactive_seconds = 0, 
                            last_session_start = $2, 
                            updated_at = NOW()
                        WHERE user_id = $3 AND today_date = $4`,
                       [preserveActive, userInfo.sessionStart, userId, currentDate]
                     );
                   } else {
                     throw insertError; // Re-throw other errors
                   }
                 }
            }
          }
        } catch (dbError) {
          console.error(`❌ Database refresh failed for ${emailString}:`, dbError.message);
        }
        console.log(`🔄 Refresh completed for existing user: ${emailString}`);
      }

                     // Store user info - ensure email is stored as string
        connectedUsers.set(socket.id, { userId: userInfo.userId, email: emailString, userInfo });
        console.log(`🔐 AUTHENTICATION COMPLETED: Socket ${socket.id} now associated with user ${emailString}`);
        console.log(`📊 Connected users map now contains:`, Array.from(connectedUsers.entries()).map(([id, data]) => `${id} -> ${data.email}`));
        // User authentication completed with data
        
        // Clean up any temporary user data that might exist
        for (const [socketId, userData] of connectedUsers.entries()) {
          if (userData.email.startsWith('temp_') && userData.email === `temp_${socketId}`) {
            console.log(`🧹 Cleaning up temporary user data for socket ${socketId}`);
            connectedUsers.delete(socketId);
          }
        }
        
        console.log(`🔄 Updated socket ${socket.id} with real user data for: ${emailString}`);
        
        // Track user connections for notifications
        if (!userConnections.has(emailString)) {
          userConnections.set(emailString, new Set());
        }
        userConnections.get(emailString).add(socket.id);

        // Track user online status (set to online when they authenticate)
        if (!userStatus.has(emailString)) {
          userStatus.set(emailString, {
            status: 'online',
            loginTime: new Date(),
            lastSeen: new Date()
          });
          console.log(`🆕 Created userStatus entry for: ${emailString}`);
        } else {
          // Update existing status to online
          const status = userStatus.get(emailString);
          status.status = 'online';
          status.loginTime = new Date();
          status.lastSeen = new Date();
          console.log(`🔄 Updated userStatus to online for: ${emailString}`);
        }

        // Get user info for the status update
        let userDisplayInfo = null;
        if (userInfo.userId) {
          userDisplayInfo = await getUserInfo(userInfo.userId);
        }
        
        // Broadcast user status update to all clients
        io.emit('user-status-update', {
          id: userInfo.userId,
          email: emailString,
          name: userDisplayInfo?.full_name || emailString,
          status: 'online',
          loginTime: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      
      // REMOVED: Online status tracking functionality
      
      // Get initial meeting status
      console.log(`👥 Getting meeting status for user: ${emailString}`);
      const isInMeeting = await getUserMeetingStatus(userInfo.userId);
      userMeetingStatus.set(emailString, isInMeeting);
      console.log(`👥 Meeting status retrieved: ${isInMeeting}`);
      
      // IMPORTANT: Don't send initial data immediately - wait for database hydration
      let initialTimerData = {
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      };
      
      // Add shift reset information if available
      console.log(`⏰ Preparing timer data for: ${emailString}`);
      const shiftInfo = userShiftInfo.get(emailString);
      if (shiftInfo) {
        const currentTime = new Date();
        const timeUntilReset = getTimeUntilNextReset(currentTime, shiftInfo);
        const formattedTimeUntilReset = formatTimeUntilReset(timeUntilReset);
        
        initialTimerData.shiftInfo = {
          period: shiftInfo.period,
          schedule: shiftInfo.schedule,
          time: shiftInfo.time,
            startTime: shiftInfo.startTime?.toISOString(),
            endTime: shiftInfo.endTime?.toISOString(),
          timeUntilReset: timeUntilReset,
          formattedTimeUntilReset: formattedTimeUntilReset,
          nextResetTime: new Date(currentTime.getTime() + timeUntilReset).toISOString()
        };
        
        console.log(`⏰ Shift reset info for ${emailString}: ${formattedTimeUntilReset} until next reset`);
      }
      
      // Send initial meeting status
      console.log(`📤 Sending meeting status for: ${emailString} - ${isInMeeting}`);
      try {
        socket.emit('meeting-status-update', { isInMeeting });
        console.log(`✅ Meeting status sent for: ${emailString}`);
      } catch (emitError) {
        console.error(`❌ Meeting status emit failed for: ${emailString}`, emitError.message);
      }
      
      // Join task activity rooms for real-time updates (by email and by userId)
      console.log(`🏠 Joining rooms for: ${emailString}`);
      try {
        socket.join(`task-activity-${emailString}`);
        if (userInfo.userId) {
          socket.join(`task-user-${userInfo.userId}`);
        }
        console.log(`✅ Rooms joined for: ${emailString}`);
      } catch (roomError) {
        console.error(`❌ Room joining failed for: ${emailString}`, roomError.message);
      }

      // Pre-create next-day activity row if needed (shift already ended)
      try { await precreateNextDayRowIfEnded(userInfo.userId); } catch {}

      // Hydrate timer from today's shift-anchored activity_data so it doesn't start at 0s
      try {
        // Read shift window
        const shiftRes = await pool.query(
          `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
          [userInfo.userId]
        );
        const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
        let shiftStartMinutes = null;
        const startMatch = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
        if (startMatch) {
          const tok = startMatch[1].trim().toUpperCase();
          const [hhmm, ampm] = tok.split(/\s+/);
          const [hhStr, mmStr] = hhmm.split(':');
          let hh = parseInt(hhStr, 10); const mm = parseInt(mmStr, 10);
          if (ampm === 'AM') { if (hh === 12) hh = 0; } else { if (hh !== 12) hh += 12; }
          shiftStartMinutes = (hh * 60) + mm;
        }
        const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
        const curMin = nowPH.getHours() * 60 + nowPH.getMinutes();
        const manilaYMD = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        let effective = new Date(nowPH);
        if (shiftStartMinutes !== null && curMin < shiftStartMinutes) {
          effective.setDate(effective.getDate() - 1);
        }
        const effectiveDateStr = manilaYMD(effective);

        const adRes = await pool.query(
          `SELECT is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start
           FROM activity_data
           WHERE user_id = $1 AND today_date = $2
           LIMIT 1`,
          [userInfo.userId, effectiveDateStr]
        );
        
        let hydratedData = null;
        
        if (adRes.rows && adRes.rows[0]) {
          const row = adRes.rows[0];
          hydratedData = {
            isActive: row.is_currently_active === true,
            activeSeconds: Number(row.today_active_seconds) || 0,
            inactiveSeconds: Number(row.today_inactive_seconds) || 0,
            sessionStart: row.last_session_start
          };
          
          // If the calculated date has zero data, try to find the most recent non-zero data
          if (hydratedData.activeSeconds === 0 && hydratedData.inactiveSeconds === 0) {
            console.log(`⚠️  Calculated date ${effectiveDateStr} has zero data for ${emailString}, looking for recent non-zero data...`);
            
            const fallbackRes = await pool.query(
              `SELECT is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, 
                      TO_CHAR(today_date, 'YYYY-MM-DD') as formatted_date
               FROM activity_data
               WHERE user_id = $1 
               AND (today_active_seconds > 0 OR today_inactive_seconds > 0)
               ORDER BY today_date DESC, updated_at DESC
               LIMIT 1`,
              [userInfo.userId]
            );
            
            if (fallbackRes.rows && fallbackRes.rows[0]) {
              const fallbackRow = fallbackRes.rows[0];
              hydratedData = {
                isActive: fallbackRow.is_currently_active === true,
                activeSeconds: Number(fallbackRow.today_active_seconds) || 0,
                inactiveSeconds: Number(fallbackRow.today_inactive_seconds) || 0,
                sessionStart: fallbackRow.last_session_start
              };
              console.log(`🔄 Found fallback data from ${fallbackRow.formatted_date}: ${hydratedData.activeSeconds}s active, ${hydratedData.inactiveSeconds}s inactive`);
            }
          }
        }
        
        if (hydratedData) {
          userInfo.isActive = hydratedData.isActive;
          userInfo.activeSeconds = hydratedData.activeSeconds;
          userInfo.inactiveSeconds = hydratedData.inactiveSeconds;
          userInfo.sessionStart = hydratedData.sessionStart || userInfo.sessionStart;
          
          // Update initial timer data with hydrated values
          initialTimerData.isActive = userInfo.isActive;
          initialTimerData.activeSeconds = userInfo.activeSeconds;
          initialTimerData.inactiveSeconds = userInfo.inactiveSeconds;
          initialTimerData.sessionStart = userInfo.sessionStart;
          
          console.log(`🔄 Hydrated timer data for ${emailString}: ${userInfo.activeSeconds}s active, ${userInfo.inactiveSeconds}s inactive`);
        }
        
        // NOW send the authenticated event with proper hydrated data
        // Create clean data object to avoid circular references
        const cleanTimerData = {
          email: emailString, // Include email for frontend user matching
          userId: userInfo.userId, // Include userId in authenticated response
          isActive: initialTimerData.isActive,
          activeSeconds: initialTimerData.activeSeconds,
          inactiveSeconds: initialTimerData.inactiveSeconds,
          sessionStart: initialTimerData.sessionStart,
          shiftInfo: initialTimerData.shiftInfo ? {
            period: initialTimerData.shiftInfo.period,
            schedule: initialTimerData.shiftInfo.schedule,
            time: initialTimerData.shiftInfo.time,
            startTime: initialTimerData.shiftInfo.startTime,
            endTime: initialTimerData.shiftInfo.endTime,
            timeUntilReset: initialTimerData.shiftInfo.timeUntilReset,
            formattedTimeUntilReset: initialTimerData.shiftInfo.formattedTimeUntilReset,
            nextResetTime: initialTimerData.shiftInfo.nextResetTime
          } : undefined
        };
        
        console.log(`📤 Sending authenticated event for: ${emailString}`);
        try {
          socket.emit('authenticated', cleanTimerData);
          console.log(`✅ Authenticated event sent for: ${emailString}`);
        } catch (authEmitError) {
          console.error(`❌ Authenticated emit failed for: ${emailString}`, authEmitError.message);
        }
        
        // Also send a timer update to ensure client has latest data
        console.log(`📤 Sending timerUpdated event for: ${emailString}`);
        try {
          socket.emit('timerUpdated', cleanTimerData);
          console.log(`✅ TimerUpdated event sent for: ${emailString}`);
        } catch (timerEmitError) {
          console.error(`❌ TimerUpdated emit failed for: ${emailString}`, timerEmitError.message);
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Authentication completed for ${emailString} in ${duration}ms`);
        
        // Resolve the authentication promise for waiting sockets
        if (resolveAuth) {
          resolveAuth();
        }
        
        // Clean up authentication tracking
        clearTimeout(authTimeout);
        authenticationInProgress.delete(emailString);
        
        // REMOVED: Online status broadcast
      } catch (error) {
        // Even if hydration fails, send authenticated event
        console.log(`⚠️ Authentication hydration failed for ${emailString}:`, error.message);
        try {
          socket.emit('authenticated', {
            email: emailString, // Include email for frontend user matching
            userId: userInfo.userId, // Include userId in authenticated response
            isActive: false,
            activeSeconds: 0,
            inactiveSeconds: 0,
            sessionStart: new Date().toISOString()
          });
        } catch (fallbackEmitError) {
          console.error(`❌ Fallback authenticated emit failed for: ${emailString}`, fallbackEmitError.message);
        }
        
        const duration = Date.now() - startTime;
        console.log(`✅ Authentication completed (with errors) for ${emailString} in ${duration}ms`);
        
        // Resolve the authentication promise for waiting sockets (even on error)
        if (resolveAuth) {
          resolveAuth();
        }
        
        // Clean up authentication tracking
        clearTimeout(authTimeout);
        authenticationInProgress.delete(emailString);
        
        // REMOVED: Online status broadcast
      }

      // Notifications are now handled by the global notification listener
      // No need for individual socket notification listeners
      
      // Clean up user connection tracking on disconnect
         socket.on('disconnect', () => {
           try {
             // Clean up user connection tracking
             const userData = connectedUsers.get(socket.id);
             if (userData) {
               let { email } = userData;
               // Ensure email is a string
               if (typeof email === 'object' && email.email) {
                 email = email.email;
               }
               email = String(email);
               
               if (userConnections.has(email)) {
                 userConnections.get(email).delete(socket.id);
                 if (userConnections.get(email).size === 0) {
                   userConnections.delete(email);
                 }
               }
               connectedUsers.delete(socket.id);
               console.log(`🔌 Socket ${socket.id} disconnected for ${email}`);
             }
           } catch (error) {
          console.error(`❌ Error cleaning up socket ${socket.id}:`, error.message);
           }
         });
        
                 // Also clean up on socket error
         socket.on('error', () => {
           try {
             // Clean up user connection tracking
             const userData = connectedUsers.get(socket.id);
             if (userData) {
               let { email } = userData;
               // Ensure email is a string
               if (typeof email === 'object' && email.email) {
                 email = email.email;
               }
               email = String(email);
               
               if (userConnections.has(email)) {
                 userConnections.get(email).delete(socket.id);
                 if (userConnections.get(email).size === 0) {
                   userConnections.delete(email);
                 }
               }
               connectedUsers.delete(socket.id);
            console.log(`🔌 Socket ${socket.id} disconnected for ${email} due to error`);
             }
           } catch (error) {
          console.error(`❌ Error cleaning up socket ${socket.id}:`, error.message);
           }
         });

      // Timer data is now sent via the authenticated event with proper hydration
    } catch (error) {
      const duration = Date.now() - startTime;
      const emailString = String(email || 'unknown');
      console.error(`❌ Authentication error for ${emailString} after ${duration}ms:`, error.message);
      socket.emit('error', { message: 'Authentication failed: ' + error.message });
      
      // Clean up authentication tracking
      if (emailString !== 'unknown') {
        clearTimeout(authTimeout);
        authenticationInProgress.delete(emailString);
      }
    }
     });
   
   // Global socket disconnect handler
   socket.on('disconnect', () => {
                  // Clean up user connection tracking
             const userData = connectedUsers.get(socket.id);
             if (userData) {
               let { email } = userData;
               // Ensure email is a string
               if (typeof email === 'object' && email.email) {
                 email = email.email;
               }
               email = String(email);
               
               if (userConnections.has(email)) {
                 userConnections.get(email).delete(socket.id);
                 if (userConnections.get(email).size === 0) {
                   userConnections.delete(email);
                   // If no more connections for this user, mark them as offline
                   if (userStatus.has(email)) {
                     const status = userStatus.get(email);
                     status.status = 'offline';
                     status.lastSeen = new Date();
                     
                     // Broadcast the offline status
                     io.emit('user-status-update', {
                       id: userData.userId || email,
                       email: email,
                       name: email, // Will be updated when user reconnects
                       status: 'offline',
                       lastSeen: new Date().toISOString()
                     });
                   }
                 }
               }
               connectedUsers.delete(socket.id);
               console.log(`🔌 Socket ${socket.id} disconnected for ${email}`);
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
          } else if (msg.channel === 'productivity_score_updated') {
            try {
              // Handle productivity score updates from database triggers
              const updateData = JSON.parse(msg.payload);
              console.log(`📊 Productivity score update notification received for user ${updateData.user_id}: ${updateData.old_score} -> ${updateData.new_score}`);
              
              // Emit real-time update to all connected clients
              emitProductivityScoreUpdate(updateData.user_id, updateData.month_year);
            } catch (error) {
              console.error('❌ Error handling productivity score update notification:', error);
            }
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
          'task_comments',
          'productivity_score_updated'
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

  // Function to emit productivity score updates to connected users
  async function emitProductivityScoreUpdate(userId, monthYear) {
    try {
      // Get the updated productivity score
      const scoreResult = await pool.query(`
        SELECT 
          ps.user_id,
          ps.productivity_score,
          ps.total_active_seconds,
          ps.total_inactive_seconds,
          ps.updated_at,
          u.email
        FROM productivity_scores ps
        JOIN users u ON ps.user_id = u.id
        WHERE ps.user_id = $1 AND ps.month_year = $2
        LIMIT 1
      `, [userId, monthYear]);
      
      if (scoreResult.rows.length > 0) {
        const score = scoreResult.rows[0];
        const email = score.email;
        
        console.log(`📊 Emitting productivity score update for ${email}: ${score.productivity_score} points`);
        
        // Emit to all connected users for real-time updates
        io.emit('productivityScoreUpdated', {
          email,
          userId: score.user_id,
          productivityScore: score.productivity_score,
          totalActiveTime: score.total_active_seconds,
          totalInactiveTime: score.total_inactive_seconds,
          timestamp: score.updated_at
        });
        
        console.log(`✅ Productivity score update emitted for ${email}`);
      }
    } catch (error) {
      console.error('❌ Error emitting productivity score update:', error);
    }
  }

  // Make the function globally available for database triggers to call
  global.emitProductivityScoreUpdate = emitProductivityScoreUpdate;

  // Team Chat Real-time Messaging
  socket.on('join-chat', async (data) => {
    try {
      const { userId, conversationId } = data;
      const userData = connectedUsers.get(socket.id);
      
      if (!userData || userData.userId !== userId) {
        socket.emit('chat-error', { message: 'Unauthorized' });
        return;
      }
      
      // Join the conversation room
      socket.join(`conversation_${conversationId}`);
      console.log(`👤 User ${userId} joined conversation ${conversationId}`);
      
      // Emit typing indicator to other participants
      socket.to(`conversation_${conversationId}`).emit('user-joined-chat', {
        userId,
        conversationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error joining chat:', error);
      socket.emit('chat-error', { message: 'Failed to join chat' });
    }
  });

  socket.on('leave-chat', async (data) => {
    try {
      const { userId, conversationId } = data;
      socket.leave(`conversation_${conversationId}`);
      console.log(`👤 User ${userId} left conversation ${conversationId}`);
      
      // Emit to other participants
      socket.to(`conversation_${conversationId}`).emit('user-left-chat', {
        userId,
        conversationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error leaving chat:', error);
    }
  });

  socket.on('send-chat-message', async (data) => {
    try {
      const { userId, conversationId, messageContent, messageType = 'text' } = data;
      const userData = connectedUsers.get(socket.id);
      
      if (!userData || userData.userId !== userId) {
        socket.emit('chat-error', { message: 'Unauthorized' });
        return;
      }
      
      // Store message in database (this will be handled by the API)
      // For now, just broadcast the message
      const messageData = {
        id: Date.now().toString(), // Temporary ID
        conversationId,
        senderId: userId,
        senderName: userData.fullName || userData.email,
        content: messageContent,
        messageType,
        timestamp: new Date().toISOString(),
        isTemporary: true
      };
      
      // Broadcast to conversation participants
      io.to(`conversation_${conversationId}`).emit('new-chat-message', messageData);
      
      // Emit delivery confirmation to sender
      socket.emit('message-delivered', {
        messageId: messageData.id,
        conversationId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`💬 Chat message sent in conversation ${conversationId} by user ${userId}`);
    } catch (error) {
      console.error('Error sending chat message:', error);
      socket.emit('chat-error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing-indicator', (data) => {
    try {
      const { userId, conversationId, isTyping } = data;
      const userData = connectedUsers.get(socket.id);
      
      if (!userData || userData.userId !== userId) return;
      
      // Broadcast typing indicator to other participants
      socket.to(`conversation_${conversationId}`).emit('user-typing', {
        userId,
        conversationId,
        isTyping,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error handling typing indicator:', error);
    }
  });

  socket.on('mark-message-read', async (data) => {
    try {
      const { userId, conversationId, messageIds } = data;
      const userData = connectedUsers.get(socket.id);
      
      if (!userData || userData.userId !== userId) return;
      
      // Emit read receipt to other participants
      socket.to(`conversation_${conversationId}`).emit('messages-read', {
        userId,
        conversationId,
        messageIds,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

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
      
      // Emit activity update only to the specific user's connections
      const userSockets = userConnections.get(userData.email);
      if (userSockets) {
        const activityData = {
          userId: userData.userId,
          email: userData.email,
          isActive: userInfo.isActive,
          activeSeconds: userInfo.activeSeconds,
          inactiveSeconds: userInfo.inactiveSeconds,
          sessionStart: userInfo.sessionStart
        };
        
        // Throttle activity update emissions: only emit every 15 seconds to reduce client load
        const lastActivityEmit = userInfo.lastActivityEmit || 0;
        const timeSinceLastActivityEmit = Date.now() - lastActivityEmit;
        const shouldEmitActivity = timeSinceLastActivityEmit >= 15000; // 15 seconds
        
        if (shouldEmitActivity) {
          console.log(`📡 Sending activity update to ${userSockets.size} connections for ${userData.email}:`, {
            activeSeconds: activityData.activeSeconds,
            inactiveSeconds: activityData.inactiveSeconds,
            isActive: activityData.isActive
          });
          
          userSockets.forEach(socketId => {
            io.to(socketId).emit('activityUpdated', activityData);
          });
          
          // Update last activity emit timestamp
          userInfo.lastActivityEmit = Date.now();
          
          console.log(`✅ Activity update sent to ${userSockets.size} connections for ${userData.email}`);
        }
      } else {
        console.log(`⚠️ No connections found for ${userData.email} to send activity update`);
      }

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
      // FIXED: Update lastShiftBoundaryTime when force reset occurs
      userInfo.lastShiftBoundaryTime = new Date().toISOString();
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
          userId: userInfo.userId,
          email: email,
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

  // Handle timer updates (throttled for performance)
  // - Database updates: every 5 seconds
  // - Socket emissions: every 10 seconds  
  // - Logging: only significant changes (30+ seconds)
  socket.on('timerUpdate', async (timerData) => {
    try {
      let userData = connectedUsers.get(socket.id);
      
      // If no user data found, this socket hasn't been authenticated yet
      if (!userData) {
        return; // Silent skip for unauthenticated sockets
      }
      
      // Skip timer updates for temporary users (they shouldn't exist after authentication)
      if (userData.email.startsWith('temp_')) {
        return; // Silent skip for temporary users
      }

      // Update in-memory data with frontend values
      const userInfo = userData.userInfo;
      const oldActive = userInfo.activeSeconds;
      const oldInactive = userInfo.inactiveSeconds;
      
      userInfo.activeSeconds = timerData.activeSeconds;
      userInfo.inactiveSeconds = timerData.inactiveSeconds;
      
      // Throttle: only log significant changes (every 30 seconds or more)
      const activeDiff = Math.abs(userInfo.activeSeconds - oldActive);
      const inactiveDiff = Math.abs(userInfo.inactiveSeconds - oldInactive);
      
      if (activeDiff >= 30 || inactiveDiff >= 30) {
        console.log(`📊 Timer updated for ${userData.email}: Active ${oldActive}s → ${userInfo.activeSeconds}s, Inactive ${oldInactive}s → ${userInfo.inactiveSeconds}s`);
      }
      
      // Also try to update database if connection is available
      try {
        // Get or create user in database
        let userId;
        
        const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [userData.email]);
        
        if (userResult.rows.length === 0) {
          const newUserResult = await pool.query('INSERT INTO users (email, user_type) VALUES ($1, $2) RETURNING id', [userData.email, 'Agent']);
          userId = newUserResult.rows[0].id;
        } else {
          userId = userResult.rows[0].id;
        }

        // Use database function for consistent date calculation with API
        let currentDate;
        let withinShift = true;
        
        try {
          // Get activity date using the same function as the API
          const dateResult = await pool.query(
            'SELECT TO_CHAR(get_activity_date_for_shift_simple($1), \'YYYY-MM-DD\') as activity_date',
            [userId]
          );
          
          if (dateResult.rows.length > 0) {
            currentDate = dateResult.rows[0].activity_date;
          } else {
            throw new Error('No date result from function');
          }
          
          // Determine withinShift using parsed shift window (more reliable for night shifts)
          try {
            const shiftRes = await pool.query(
              `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
              [userId]
            );
            const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
            console.log(`🔍 Shift window check for ${userData.email}: shift_time="${shiftText}"`);
            const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
            if (both) {
              const parseToMinutes = (token) => {
                const [hhmm, ampm] = token.split(/\s+/);
                const [hhStr, mmStr] = hhmm.split(':');
                let hh = parseInt(hhStr, 10);
                const mm = parseInt(mmStr, 10);
                if (ampm === 'AM') { if (hh === 12) hh = 0; } else if (ampm === 'PM') { if (hh !== 12) hh += 12; }
                return (hh * 60) + mm;
              };
              const startMinutes = parseToMinutes(both[1].trim().toUpperCase());
              const endMinutes = parseToMinutes(both[2].trim().toUpperCase());
              const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
              const curMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
              if (endMinutes > startMinutes) {
                withinShift = curMinutes >= startMinutes && curMinutes < endMinutes; // day shift
              } else {
                withinShift = (curMinutes >= startMinutes) || (curMinutes < endMinutes); // night shift crossing midnight
              }
              console.log(`🔍 Shift window calculation: start=${startMinutes}min, end=${endMinutes}min, current=${curMinutes}min, withinShift=${withinShift}`);
            } else {
              withinShift = true; // default allow if shift text not parsable
              console.log(`🔍 Shift window: using default withinShift=true (shift text not parsable)`);
            }
          } catch (_) {
            withinShift = true; // be permissive on errors so counting still saves
            console.log(`🔍 Shift window: using default withinShift=true (error in calculation)`);
          }
          
        } catch (dbError) {
          console.error('Database function failed, falling back to manual calculation:', dbError.message);
          
          // Fallback to original logic if database functions fail
          let shiftStartMinutes = null;
          let hasShiftStart = false;
          let shiftEndMinutes = null;
          let hasShiftEnd = false;
          
          try {
            const shiftRes = await pool.query(
              `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
              [userId]
            );
            const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
            const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
            
            if (both) {
              const start = both[1].trim().toUpperCase();
              const end = both[2].trim().toUpperCase();
              const parseToMinutes = (token) => {
                const [hhmm, ampm] = token.split(/\s+/);
                const [hhStr, mmStr] = hhmm.split(':');
                let hh = parseInt(hhStr, 10);
                const mm = parseInt(mmStr, 10);
                if (ampm === 'AM') { if (hh === 12) hh = 0; } 
                else if (ampm === 'PM') { if (hh !== 12) hh += 12; }
                return (hh * 60) + mm;
              };
              shiftStartMinutes = parseToMinutes(start);
              shiftEndMinutes = parseToMinutes(end);
              hasShiftStart = true;
              hasShiftEnd = true;
            }
          } catch (_) {}

          const philippinesNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
          const currentMinutesLocal = philippinesNow.getHours() * 60 + philippinesNow.getMinutes();

          if (hasShiftStart && hasShiftEnd && shiftStartMinutes !== null && shiftEndMinutes !== null) {
            if (shiftEndMinutes > shiftStartMinutes) {
              withinShift = currentMinutesLocal >= shiftStartMinutes && currentMinutesLocal < shiftEndMinutes;
            } else {
              withinShift = (currentMinutesLocal >= shiftStartMinutes) || (currentMinutesLocal < shiftEndMinutes);
            }
          }

          const manilaYMD = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };
          const effective = new Date(philippinesNow);
          if (hasShiftStart && shiftStartMinutes !== null) {
            if (currentMinutesLocal < shiftStartMinutes) {
              effective.setDate(effective.getDate() - 1);
            }
          }
          currentDate = manilaYMD(effective);
        }
        
        // Update activity data in database with daily tracking (Philippines timezone)
        // Guard: do NOT update during the 2s immediately following a server-side reset broadcast
        if (userInfo.lastResetAt && (Date.now() - userInfo.lastResetAt) < 2000) {
          return; // avoid a race that could re-insert pre-reset counters
        }
        
        // Throttle database updates: only update every 2-3 seconds to reduce load
        const lastDbUpdate = userInfo.lastDbUpdate || 0;
        const timeSinceLastUpdate = Date.now() - lastDbUpdate;
        const shouldUpdateDb = timeSinceLastUpdate >= 2000; // 2 seconds instead of 5
        
        if (withinShift && shouldUpdateDb) {
          console.log(`💾 Updating database for ${userData.email} - within shift window (date: ${currentDate})`);
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
          
          // Update last database update timestamp
          userInfo.lastDbUpdate = Date.now();
          
          console.log(`✅ Database updated successfully for ${userData.email}`);
        } else if (!withinShift) {
          console.log(`⏸️ Skipping database update for ${userData.email} - outside shift window (date: ${currentDate})`);
          // Outside shift window: do not increment or create rows
        } else if (!shouldUpdateDb) {
          // Silent skip for throttled updates - no logging to reduce spam
        }
        
        // Only log timer updates when database is updated or for significant changes (every 30 seconds)
        const shouldLogTimer = shouldUpdateDb || (userInfo.activeSeconds % 30 === 0) || (userInfo.inactiveSeconds % 30 === 0);
        if (shouldLogTimer) {
          console.log(`💾 Updated timer for ${userData.email}: Active=${userInfo.activeSeconds}s, Inactive=${userInfo.inactiveSeconds}s`);
        }
        
        // Database save successful
      } catch (dbError) {
        console.error('Database update failed:', dbError.message);
      }
      
              // Emit timer update only to the specific user's connections (throttled)
        const userSockets = userConnections.get(userData.email);
        if (userSockets) {
          const timerData = {
            userId: userData.userId,
            email: userData.email,
            isActive: userInfo.isActive,
            activeSeconds: userInfo.activeSeconds,
            inactiveSeconds: userInfo.inactiveSeconds,
            sessionStart: userInfo.sessionStart
          };
          
          // Throttle socket emissions: only emit every 10 seconds to reduce client load
          const lastSocketEmit = userInfo.lastSocketEmit || 0;
          const timeSinceLastEmit = Date.now() - lastSocketEmit;
          const shouldEmitSocket = timeSinceLastEmit >= 10000; // 10 seconds
          
          if (shouldEmitSocket) {
            console.log(`📡 Sending timer update to ${userSockets.size} connections for ${userData.email}:`, {
              activeSeconds: timerData.activeSeconds,
              inactiveSeconds: timerData.inactiveSeconds,
              isActive: timerData.isActive
            });
            
            userSockets.forEach(socketId => {
              io.to(socketId).emit('timerUpdated', timerData);
            });
            
            // Update last socket emit timestamp
            userInfo.lastSocketEmit = Date.now();
            
            console.log(`✅ Timer update sent to ${userSockets.size} connections for ${userData.email}`);
          }
        } else {
          console.log(`⚠️ No connections found for ${userData.email} to send timer update`);
        }

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





  // Handle productivity score updates
  socket.on('productivity-update', async (data) => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      const email = userData.email;
      
      console.log(`📊 Productivity update for ${email}: ${data.productivityScore} points`);
      
      // Broadcast productivity update to all connected users for real-time leaderboard updates
      io.emit('productivity-update', {
        email,
        userId: userData.userId,
        productivityScore: data.productivityScore,
        totalActiveTime: data.totalActiveTime,
        totalInactiveTime: data.totalInactiveTime,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Handle requests for productivity data
  socket.on('requestProductivityData', async (data) => {
    try {
      const { email, userId } = data;
      console.log(`📊 Productivity data requested for ${email} (ID: ${userId})`);
      
      // Get current productivity score from database
      const currentScore = await pool.query(`
        SELECT 
          ps.productivity_score,
          ps.total_active_seconds,
          ps.total_inactive_seconds,
          ps.updated_at
        FROM productivity_scores ps
        WHERE ps.user_id = $1 
        AND ps.month_year = to_char(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM')
        LIMIT 1
      `, [userId]);
      
      if (currentScore.rows.length > 0) {
        const score = currentScore.rows[0];
        
        // Emit current productivity data to the requesting user
        socket.emit('productivityScoreUpdated', {
          email,
          userId,
          productivityScore: score.productivity_score,
          totalActiveTime: score.total_active_seconds,
          totalInactiveTime: score.total_inactive_seconds,
          timestamp: score.updated_at
        });
        
        console.log(`✅ Productivity data sent to ${email}: ${score.productivity_score} points`);
      } else {
        console.log(`⚠️  No productivity score found for ${email} (ID: ${userId})`);
      }
    } catch (error) {
      console.error('❌ Error fetching productivity data:', error);
      socket.emit('error', { message: 'Failed to fetch productivity data' });
    }
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

   // Handle request for connected users list
   socket.on('get-connected-users', async () => {
     try {
       const usersList = await getConnectedUsersList();
       socket.emit('connected-users-list', usersList);
     } catch (error) {
       console.error('Error getting connected users list:', error);
       socket.emit('error', { message: 'Failed to get connected users list' });
     }
   });

   // Handle user logout event
   socket.on('user-logout', async (email) => {
     const emailString = typeof email === 'string' ? email : String(email);
     console.log(`🚪 User logout event received for: ${emailString}`);
     
     if (userStatus.has(emailString)) {
       const status = userStatus.get(emailString);
       status.status = 'offline';
       status.lastSeen = new Date();
       
       // Get user ID and info from userData
       let userId = null;
       let userName = emailString;
       const userInfo = userData.get(emailString);
       if (userInfo && userInfo.userId) {
         userId = userInfo.userId;
         // Get user name from database
         try {
           const userDisplayInfo = await getUserInfo(userInfo.userId);
           if (userDisplayInfo?.full_name) {
             userName = userDisplayInfo.full_name;
           }
         } catch (error) {
           console.error('Error fetching user name for logout:', error);
         }
       }
       
       // Broadcast user status update to all clients
       io.emit('user-status-update', {
         id: userId || emailString, // Fallback to email if no user ID found
         email: emailString,
         name: userName,
         status: 'offline',
         loginTime: status.loginTime?.toISOString(),
         lastSeen: new Date().toISOString()
       });

       // Also emit specific logout event
       io.emit('user-logged-out', emailString);
       
       console.log(`👤 User ${emailString} logged out - status set to offline`);
     } else {
       console.log(`⚠️ User ${emailString} not found in userStatus during logout`);
     }
   });

   // Handle user login event (for tracking login time)
   socket.on('user-login', async (email) => {
     const emailString = typeof email === 'string' ? email : String(email);
     console.log(`🚪 User login event received for: ${emailString}`);
     
     // Ensure userStatus entry exists for this user
     if (!userStatus.has(emailString)) {
       userStatus.set(emailString, {
         status: 'online',
         loginTime: new Date(),
         lastSeen: new Date()
       });
       console.log(`🆕 Created new userStatus entry for: ${emailString}`);
     } else {
       const status = userStatus.get(emailString);
       status.status = 'online';
       status.loginTime = new Date();
       status.lastSeen = new Date();
     }
     
     // Get user ID and info from userData
     let userId = null;
     let userName = emailString;
     const userInfo = userData.get(emailString);
     if (userInfo && userInfo.userId) {
       userId = userInfo.userId;
       // Get user name from database
       try {
         const userDisplayInfo = await getUserInfo(userInfo.userId);
         if (userDisplayInfo?.full_name) {
           userName = userDisplayInfo.full_name;
         }
       } catch (error) {
         console.error('Error fetching user name for login:', error);
       }
     }
     
     // Broadcast user status update to all clients
     io.emit('user-status-update', {
       id: userId || emailString, // Fallback to email if no user ID found
       email: emailString,
       name: userName,
       status: 'online',
       loginTime: userStatus.get(emailString).loginTime?.toISOString(),
       lastSeen: new Date().toISOString()
     });
     
     console.log(`👤 User ${emailString} logged in - status set to online`);
   });
});

const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
}); 

// Add this function to reset in-memory data when shift ends
async function resetInMemoryDataAfterShiftEnd(email, userId) {
  try {
    const userInfo = userData.get(email);
    if (!userInfo) return;
    
    const shiftInfo = userShiftInfo.get(email);
    if (!shiftInfo) return;
    
    const currentTime = new Date();
    
    // Check if current shift has ended
    if (shiftInfo.isNightShift) {
      // For night shifts: check if we're between 7 AM and 10 PM (shift ended)
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const currentMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
      const startMinutes = shiftInfo.startTime.getHours() * 60 + shiftInfo.startTime.getMinutes();
      const endMinutes = shiftInfo.endTime.getHours() * 60 + shiftInfo.endTime.getMinutes();
      
      // Shift has ended if we're between end time (7 AM) and start time (10 PM)
      const shiftEnded = currentMinutes >= endMinutes && currentMinutes < startMinutes;
      
      if (shiftEnded) {
        console.log(`🌙 Night shift ended for ${email} - resetting in-memory timer to 0s`);
        userInfo.activeSeconds = 0;
        userInfo.inactiveSeconds = 0;
        userInfo.isActive = false;
        userInfo.sessionStart = new Date().toISOString();
        // FIXED: Update lastShiftBoundaryTime when shift ends to prevent premature resets
        userInfo.lastShiftBoundaryTime = currentTime.toISOString();
        
        // DON'T update the database when shift ends - preserve the completed day's data
        // Only reset in-memory data for the new session
        console.log(`💾 Preserving completed day's data for ${email} - shift ended, data saved`);
        
        // Notify frontend about the reset
        const userSockets = userConnections.get(email);
        if (userSockets) {
          const resetData = {
            userId: userInfo.userId,
            email: email,
            isActive: false,
            activeSeconds: 0,
            inactiveSeconds: 0,
            sessionStart: userInfo.sessionStart,
            resetReason: 'shift_ended',
            shiftId: getCurrentShiftId(currentTime, shiftInfo)
          };
          
          userSockets.forEach(socketId => {
            io.to(socketId).emit('shiftReset', resetData);
            io.to(socketId).emit('timerUpdated', resetData);
          });
          
          console.log(`📡 Notified frontend about shift end reset for ${email}`);
        }
      }
    } else {
      // For day shifts: check if we're past 3 PM (shift ended)
      const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
      const currentMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
      const endMinutes = shiftInfo.endTime.getHours() * 60 + shiftInfo.endTime.getMinutes();
      
      // Shift has ended if we're past 3 PM
      const shiftEnded = currentMinutes >= endMinutes;
      
      if (shiftEnded) {
        console.log(`☀️ Day shift ended for ${email} - resetting in-memory timer to 0s`);
        userInfo.activeSeconds = 0;
        userInfo.inactiveSeconds = 0;
        userInfo.isActive = false;
        userInfo.sessionStart = new Date().toISOString();
        // FIXED: Update lastShiftBoundaryTime when shift ends to prevent premature resets
        userInfo.lastShiftBoundaryTime = currentTime.toISOString();
        
        // DON'T update the database when shift ends - preserve the completed day's data
        // Only reset in-memory data for the new session
        console.log(`💾 Preserving completed day's data for ${email} - shift ended, data saved`);
        
        // Notify frontend about the reset
        const userSockets = userConnections.get(email);
        if (userSockets) {
          const resetData = {
            userId: userInfo.userId,
            email: email,
            isActive: false,
            activeSeconds: 0,
            inactiveSeconds: 0,
            sessionStart: userInfo.sessionStart,
            resetReason: 'shift_ended',
            shiftId: getCurrentShiftId(currentTime, shiftInfo)
          };
          
          userSockets.forEach(socketId => {
            io.to(socketId).emit('shiftReset', resetData);
            io.to(socketId).emit('timerUpdated', resetData);
          });
          
          console.log(`📡 Notified frontend about shift end reset for ${email}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error resetting in-memory data for ${email}:`, error);
  }
}

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
            
            // NEW: Check if current shift has ended and reset in-memory data
            await resetInMemoryDataAfterShiftEnd(email, userInfo.userId);
            
            // Also check break availability windows
          const shiftInfo = userShiftInfo.get(email);
          if (shiftInfo) {
            // Check if we're within critical timing windows for more frequent checks
            const currentTime = new Date();
            const timeUntilReset = getTimeUntilNextReset(currentTime, shiftInfo);
            
            // Only do additional checks if we're within 5 minutes of reset
            if (timeUntilReset <= 300000 && timeUntilReset > 0) {
              // If within 30 seconds, log critical timing
              if (timeUntilReset <= 30000) {
                console.log(`⏰ Critical timing: ${email} reset in ${Math.floor(timeUntilReset/1000)}s`);
              }
              
              // If within 10 seconds, log ultra-critical timing
              if (timeUntilReset <= 10000) {
                console.log(`🚨 Ultra-critical timing: ${email} reset in ${Math.floor(timeUntilReset/1000)}s`);
              }
              
              // If within 5 seconds, log final countdown
              if (timeUntilReset <= 5000) {
                console.log(`💥 Final countdown: ${email} reset in ${Math.floor(timeUntilReset/1000)}s`);
              }
            }
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
}, 30000); // Check every 30 seconds to reduce log spam

// Start periodic connected users refresh to keep status up to date
const connectedUsersRefreshInterval = setInterval(async () => {
  try {
    // Only refresh if we have online users
    if (userStatus.size > 0) {
      console.log(`🔄 Periodic connected users refresh - checking ${userStatus.size} users`);
      
      // Find any online user to get team info
      let referenceUser = null;
      for (const [email, status] of userStatus.entries()) {
        if (status.status === 'online') {
          const userDataEntry = userData.get(email);
          if (userDataEntry && userDataEntry.userId) {
            referenceUser = userDataEntry;
            break;
          }
        }
      }
      
      if (referenceUser) {
        // Get member_id and refresh team status
        try {
          const memberQuery = `
            SELECT a.member_id
            FROM agents a
            WHERE a.user_id = $1
            LIMIT 1
          `;
          const memberResult = await pool.query(memberQuery, [referenceUser.userId]);
          
          if (memberResult.rows.length > 0) {
            const memberId = memberResult.rows[0].member_id;
            await initializeTeamUserStatus(memberId);
            console.log(`✅ Periodic team status refresh completed for team ${memberId}`);
          }
        } catch (error) {
          console.error('❌ Error in periodic team status refresh:', error);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in periodic connected users refresh:', error);
  }
}, 60000); // Check every 60 seconds

// NEW: Start periodic database sync to ensure timer data is saved regularly
const periodicDatabaseSyncInterval = setInterval(async () => {
  try {
    console.log(`💾 Periodic database sync - checking ${userData.size} users`);
    
    // Sync all connected users' timer data to database
    for (const [email, userDataEntry] of userData.entries()) {
      if (userDataEntry.userId && userDataEntry.userInfo) {
        try {
          const userInfo = userDataEntry.userInfo;
          
          // Skip if no timer data to sync
          if (userInfo.activeSeconds === 0 && userInfo.inactiveSeconds === 0) {
            continue;
          }
          
          // Get or create user in database
          let userId = userInfo.userId;
          
          // Use database function for consistent date calculation with API
          let currentDate;
          let withinShift = true;
          
          try {
            // Get activity date using the same function as the API
            const dateResult = await pool.query(
              'SELECT TO_CHAR(get_activity_date_for_shift_simple($1), \'YYYY-MM-DD\') as activity_date',
              [userId]
            );
            
            if (dateResult.rows.length > 0) {
              currentDate = dateResult.rows[0].activity_date;
            } else {
              throw new Error('No date result from function');
            }
            
            // Determine withinShift using parsed shift window
            try {
              const shiftRes = await pool.query(
                `SELECT ji.shift_time FROM job_info ji WHERE ji.agent_user_id = $1 LIMIT 1`,
                [userId]
              );
              const shiftText = (shiftRes.rows[0]?.shift_time || '').toString();
              const both = shiftText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*-\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
              if (both) {
                const parseToMinutes = (token) => {
                  const [hhmm, ampm] = token.split(/\s+/);
                  const [hhStr, mmStr] = hhmm.split(':');
                  let hh = parseInt(hhStr, 10);
                  const mm = parseInt(mmStr, 10);
                  if (ampm === 'AM') { if (hh === 12) hh = 0; } else if (ampm === 'PM') { if (hh !== 12) hh += 12; }
                  return (hh * 60) + mm;
                };
                const startMinutes = parseToMinutes(both[1].trim().toUpperCase());
                const endMinutes = parseToMinutes(both[2].trim().toUpperCase());
                const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
                const curMinutes = nowPH.getHours() * 60 + nowPH.getMinutes();
                if (endMinutes > startMinutes) {
                  withinShift = curMinutes >= startMinutes && curMinutes < endMinutes; // day shift
                } else {
                  withinShift = (curMinutes >= startMinutes) || (curMinutes < endMinutes); // night shift crossing midnight
                }
              } else {
                withinShift = true; // default allow if shift text not parsable
              }
            } catch (_) {
              withinShift = true; // be permissive on errors so counting still saves
            }
            
          } catch (dbError) {
            console.error(`Database function failed for ${email}, falling back to manual calculation:`, dbError.message);
            
            // Fallback to manual calculation
            const philippinesNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
            const manilaYMD = (d) => {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}`;
            };
            currentDate = manilaYMD(philippinesNow);
          }
          
          // Update activity data in database
          if (withinShift) {
            console.log(`💾 Periodic sync: Updating database for ${email} (date: ${currentDate}) - Active: ${userInfo.activeSeconds}s, Inactive: ${userInfo.inactiveSeconds}s`);
            
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
            
            console.log(`✅ Periodic sync completed for ${email}`);
          } else {
            console.log(`⏸️ Periodic sync: Skipping ${email} - outside shift window (date: ${currentDate})`);
          }
          
        } catch (userError) {
          console.error(`❌ Error in periodic sync for ${email}:`, userError.message);
          // Continue with other users instead of failing the entire cycle
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in periodic database sync:', error);
  }
}, 15000); // Sync every 15 seconds to ensure data is saved regularly

// Cleanup interval on server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down monitoring intervals...');
  clearInterval(shiftResetInterval);
  clearInterval(connectedUsersRefreshInterval);
  clearInterval(periodicDatabaseSyncInterval);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Shutting down monitoring intervals...');
  clearInterval(shiftResetInterval);
  clearInterval(connectedUsersRefreshInterval);
  clearInterval(periodicDatabaseSyncInterval);
  process.exit(0);
});