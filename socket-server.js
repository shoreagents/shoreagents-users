require('dotenv').config({ path: '.env.local' });

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');
const redis = require('redis');
const BreakReminderScheduler = require('./scripts/break-reminder-scheduler');
const TaskNotificationScheduler = require('./scripts/task-notification-scheduler');
const MeetingScheduler = require('./scripts/meeting-scheduler');
const EventReminderScheduler = require('./scripts/event-reminder-scheduler');
const AnnouncementScheduler = require('./scripts/announcement-scheduler');

const app = express();
app.use(cors());

// Status endpoint to monitor schedulers
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString(),
    schedulers: {
      breakReminder: breakReminderScheduler.getStatus(),
      taskNotification: taskNotificationScheduler.getStatus(),
      meeting: meetingScheduler.getStatus(),
      eventReminder: eventReminderScheduler.getStatus(),
      announcement: announcementScheduler.getStatus()
    },
    uptime: process.uptime()
  });
});

// Enhanced connection metrics endpoint
app.get('/metrics', (req, res) => {
  const uptime = Date.now() - connectionMetrics.startTime;
  const errorRate = connectionMetrics.totalConnections > 0 
    ? (connectionMetrics.errors / connectionMetrics.totalConnections * 100).toFixed(2) 
    : 0;
  
  // Calculate health status based on multiple factors
  const healthStatus = calculateHealthStatus();
  
  res.json({
    connections: {
      total: connectionMetrics.totalConnections,
      active: connectionMetrics.activeConnections,
      disconnections: connectionMetrics.disconnections,
      errors: connectionMetrics.errors,
      reconnections: connectionMetrics.reconnections,
      errorRate: `${errorRate}%`,
      pingTimeouts: connectionMetrics.pingTimeouts,
      pingTimeoutRate: `${connectionMetrics.pingTimeoutRate.toFixed(2)}%`,
      reconnectionRate: `${connectionMetrics.reconnectionRate.toFixed(2)}%`,
      averageDuration: Math.round(connectionMetrics.averageConnectionDuration / 1000) + 's'
    },
    quality: {
      excellent: connectionMetrics.connectionQuality.excellent,
      good: connectionMetrics.connectionQuality.good,
      fair: connectionMetrics.connectionQuality.fair,
      poor: connectionMetrics.connectionQuality.poor
    },
    transport: connectionMetrics.transportStats,
    pooling: {
      maxPerUser: connectionPool.maxConnectionsPerUser,
      maxTotal: connectionPool.maxTotalConnections,
      atCapacity: connectionPool.isAtCapacity(),
      userLimits: Object.fromEntries(connectionPool.userConnectionLimits)
    },
    uptime: {
      total: Math.floor(uptime / 1000),
      since: new Date(connectionMetrics.startTime).toISOString()
    },
    health: {
      status: healthStatus.status,
      score: healthStatus.score,
      warnings: healthStatus.warnings,
      lastReset: new Date(connectionMetrics.lastReset).toISOString()
    },
    circuitBreaker: {
      isOpen: circuitBreaker.isOpen,
      errorCount: circuitBreaker.errorCount,
      threshold: circuitBreaker.threshold,
      lastErrorTime: circuitBreaker.lastErrorTime ? new Date(circuitBreaker.lastErrorTime).toISOString() : null
    },
    users: {
      totalTracked: connectionMetrics.userConnectionHistory.size,
      topConnectors: getTopConnectors(5),
      problemUsers: getProblemUsers()
    }
  });
});

// Calculate overall health status
function calculateHealthStatus() {
  const warnings = [];
  let score = 100;

  // Check ping timeout rate
  if (connectionMetrics.pingTimeoutRate > qualityThresholds.pingTimeoutWarning) {
    warnings.push(`High ping timeout rate: ${connectionMetrics.pingTimeoutRate.toFixed(2)}%`);
    score -= 20;
  }

  // Check reconnection rate
  if (connectionMetrics.reconnectionRate > qualityThresholds.reconnectionWarning) {
    warnings.push(`High reconnection rate: ${connectionMetrics.reconnectionRate.toFixed(2)}%`);
    score -= 15;
  }

  // Check average connection duration
  if (connectionMetrics.averageConnectionDuration < qualityThresholds.connectionDurationWarning) {
    warnings.push(`Short average connection duration: ${Math.round(connectionMetrics.averageConnectionDuration / 1000)}s`);
    score -= 10;
  }

  // Check error rate
  const errorRate = connectionMetrics.totalConnections > 0 
    ? (connectionMetrics.errors / connectionMetrics.totalConnections) * 100 
    : 0;
  if (errorRate > 5) {
    warnings.push(`High error rate: ${errorRate.toFixed(2)}%`);
    score -= 25;
  }

  // Check capacity
  if (connectionPool.isAtCapacity()) {
    warnings.push('Server at capacity');
    score -= 30;
  }

  let status = 'healthy';
  if (score < 50) status = 'critical';
  else if (score < 70) status = 'warning';
  else if (score < 90) status = 'good';

  return { status, score: Math.max(0, score), warnings };
}

// Get top users by connection count
function getTopConnectors(limit = 5) {
  return Array.from(connectionMetrics.userConnectionHistory.entries())
    .map(([email, data]) => ({ email, connections: data.totalConnections }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, limit);
}

// Get users with connection problems
function getProblemUsers() {
  return Array.from(connectionMetrics.userConnectionHistory.entries())
    .filter(([email, data]) => {
      const pingTimeoutRate = data.totalConnections > 0 ? (data.pingTimeouts / data.totalConnections) * 100 : 0;
      return pingTimeoutRate > 10 || data.reconnections > 5;
    })
    .map(([email, data]) => ({
      email,
      pingTimeouts: data.pingTimeouts,
      reconnections: data.reconnections,
      quality: assessConnectionQuality(email)
    }));
}

// Get active socket connections endpoint
app.get('/connections', async (req, res) => {
  try {
    if (!isPoolAvailable()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const query = `
      SELECT 
        sc.socket_id,
        sc.email,
        sc.connected_at,
        sc.last_heartbeat,
        sc.transport,
        sc.connection_status,
        sc.user_agent,
        sc.ip_address,
        COALESCE(pi.first_name || ' ' || pi.last_name, u.email) as full_name
      FROM socket_connections sc
      JOIN users u ON sc.user_id = u.id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE sc.connection_status = 'active'
      ORDER BY sc.connected_at DESC
    `;

    const result = await pool.query(query);
    
    res.json({
      activeConnections: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching active connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Get connection history for a specific user
app.get('/connections/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    if (!isPoolAvailable()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const query = `
      SELECT 
        sc.socket_id,
        sc.email,
        sc.connected_at,
        sc.last_heartbeat,
        sc.disconnected_at,
        sc.transport,
        sc.connection_status,
        sc.user_agent,
        sc.ip_address
      FROM socket_connections sc
      WHERE sc.email = $1
      ORDER BY sc.connected_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query, [email]);
    
    res.json({
      user: email,
      connections: result.rows,
      count: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error fetching connections for ${req.params.email}:`, error);
    res.status(500).json({ error: 'Failed to fetch user connections' });
  }
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL,
    methods: ["GET", "POST"]
  },
  // Railway-optimized ping/pong settings for better stability
  pingTimeout: 120000, // 2 minutes (increased for better stability)
  pingInterval: 30000, // 30 seconds (aligned with client heartbeat)
  upgradeTimeout: 15000, // 15 seconds for upgrade handshake
  allowEIO3: true, // Allow Engine.IO v3 clients for better compatibility
  transports: ['websocket', 'polling'], // Prioritize websocket for better performance
  // Add connection state management
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  },
  // Additional Railway-specific optimizations
  serveClient: false, // Don't serve client files
  // Increase buffer sizes for Railway
  maxHttpBufferSize: 1e6, // 1MB
  // Add graceful shutdown handling
  closeOnDisconnect: false,
  // Add compression for better performance
  compression: true,
  // Add per-message deflate
  perMessageDeflate: {
    threshold: 1024,
    concurrencyLimit: 10,
    memLevel: 7
  }
});

// Database connection - Railway-optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Railway-optimized connection settings
  max: 10, // Reduced for Railway stability
  min: 2, // Minimum connections
  idleTimeoutMillis: 60000, // 1 minute (increased for stability)
  connectionTimeoutMillis: 10000, // 10 seconds (increased for Railway)
  maxUses: 1000, // Reduced to prevent connection exhaustion
  // Add keep-alive settings for Railway
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Add statement timeout
  statement_timeout: 30000,
  query_timeout: 30000,
  // Add application name for debugging
  application_name: 'socket-server-railway'
});

// Add error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process, just log the error
});

// Add error handling for individual client errors
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('PostgreSQL client error:', err);
    // Don't exit the process, just log the error
  });
});

// Redis client for cache invalidation
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  // Add retry settings for better resilience
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.log('Redis: Max retries reached, giving up');
        return new Error('Max retries reached');
      }
      const delay = Math.min(retries * 50, 500);
      console.log(`Redis: Retrying connection in ${delay}ms (attempt ${retries})`);
      return delay;
    }
  }
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
  // Don't exit the process, just log the error
});

redisClient.on('connect', () => {
  console.log('Redis client connected');
});

// Redis session management functions
async function storeUserSession(socketId, userData) {
  try {
    const sessionKey = `session:${socketId}`;
    const sessionData = {
      ...userData,
      lastSeen: Date.now(),
      createdAt: Date.now()
    };
    await redisClient.setEx(sessionKey, 3600, JSON.stringify(sessionData)); // 1 hour TTL
    return true;
  } catch (error) {
    console.error('Error storing user session:', error);
    return false;
  }
}

async function getUserSession(socketId) {
  try {
    const sessionKey = `session:${socketId}`;
    const sessionData = await redisClient.get(sessionKey);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch (error) {
    console.error('Error getting user session:', error);
    return null;
  }
}

async function removeUserSession(socketId) {
  try {
    const sessionKey = `session:${socketId}`;
    await redisClient.del(sessionKey);
    return true;
  } catch (error) {
    console.error('Error removing user session:', error);
    return false;
  }
}

async function updateUserSession(socketId, updates) {
  try {
    const sessionData = await getUserSession(socketId);
    if (sessionData) {
      const updatedData = { ...sessionData, ...updates, lastSeen: Date.now() };
      await storeUserSession(socketId, updatedData);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating user session:', error);
    return false;
  }
}

redisClient.on('reconnecting', () => {
  console.log('Redis client reconnecting...');
});

redisClient.on('end', () => {
  console.log('Redis client disconnected');
});

// Add process-level error handling to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process, just log the error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log the error
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Helper function to check if pool is available
function isPoolAvailable() {
  return pool && !pool.ended;
}

// Helper function to find and emit to user sockets
function emitToUserSockets(userId, targetEmail, eventName, payload) {
  // First try to get sockets from userConnections map
  let userSockets = userConnections.get(targetEmail);
  
  // If not found in userConnections, try to find all sockets for this user in connectedUsers
  if (!userSockets || userSockets.size === 0) {
    console.log(`User ${targetEmail} not found in userConnections, searching connectedUsers directly`);
    const directSockets = [];
    for (const [socketId, userData] of connectedUsers.entries()) {
      if (userData.email === targetEmail) {
        directSockets.push(socketId);
      }
    }
    if (directSockets.length > 0) {
      console.log(`Found ${directSockets.length} direct connections for user ${targetEmail}`);
      directSockets.forEach(socketId => {
        io.to(socketId).emit(eventName, payload);
      });
    } else {
      console.log(`No active connections found for user ${userId} (${targetEmail})`);
    }
  } else {
    console.log(`Broadcasting ${eventName} to ${userSockets.size} connections for user ${userId} (${targetEmail})`);
    userSockets.forEach(socketId => {
      io.to(socketId).emit(eventName, payload);
    });
  }
}

// Test database connection with better error handling
pool.query('SELECT NOW()', (err, result) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    // Don't exit the process, just log the error
  } else {
    console.log('Database connected successfully');
  }
});

// Initialize schedulers
const breakReminderScheduler = new BreakReminderScheduler();
const taskNotificationScheduler = new TaskNotificationScheduler();
const meetingScheduler = new MeetingScheduler();
const eventReminderScheduler = new EventReminderScheduler();
const announcementScheduler = new AnnouncementScheduler();

console.log('Initializing break reminder scheduler...');
breakReminderScheduler.start();

console.log('Initializing task notification scheduler...');
taskNotificationScheduler.start();

console.log('Initializing meeting scheduler...');
meetingScheduler.start();

console.log('Initializing event reminder scheduler...');
eventReminderScheduler.start();

console.log('Initializing announcement scheduler...');
announcementScheduler.start();

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
    await globalNotificationClient.query('LISTEN activity_data_change');
    await globalNotificationClient.query('LISTEN meeting_status_change');
    await globalNotificationClient.query('LISTEN "meeting-update"');
    await globalNotificationClient.query('LISTEN health_check_events');
    await globalNotificationClient.query('LISTEN event_changes');
    await globalNotificationClient.query('LISTEN event_attendance_changes');
    await globalNotificationClient.query('LISTEN announcements');
    
    console.log('Global notification listener initialized');
    
    globalNotificationClient.on('notification', async (msg) => {
      try {
        if (msg.channel === 'notifications') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            console.log(`Looking for user ${payload.user_id} in ${connectedUsers.size} connected users`);
            console.log(`Connected users:`, Array.from(connectedUsers.entries()).map(([id, data]) => `${id}: ${data.email} (userId: ${data.userId})`));
            
            // Find the user's email by looking through all connected users
            let targetEmail = null;
            let foundUserData = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              console.log(`Checking socket ${socketId}: userId=${userData.userId}, email=${userData.email}, payload.user_id=${payload.user_id}, match=${String(userData.userId) === String(payload.user_id)}`);
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                foundUserData = userData;
                console.log(`Found matching user: ${targetEmail}`);
                break;
              }
            }
            
            // If no direct match found, try to find by email if payload contains email
            if (!targetEmail && payload.email) {
              console.log(`No direct userId match found, trying to find by email: ${payload.email}`);
              for (const [socketId, userData] of connectedUsers.entries()) {
                if (userData.email === payload.email) {
                  targetEmail = userData.email;
                  console.log(`Found user by email: ${targetEmail} (userId: ${userData.userId})`);
                  break;
                }
              }
            }
            
            // If still no match, try to resolve user_id to email from database
            if (!targetEmail) {
              try {
                console.log(`Attempting to resolve user_id ${payload.user_id} to email from database`);
                const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [payload.user_id]);
                if (userResult.rows.length > 0) {
                  const dbEmail = userResult.rows[0].email;
                  console.log(`Found email in database: ${dbEmail} for user_id ${payload.user_id}`);
                  
                  // Check if this email has any connected sockets
                  for (const [socketId, userData] of connectedUsers.entries()) {
                    if (userData.email === dbEmail) {
                      targetEmail = userData.email;
                      console.log(`Found connected user by database lookup: ${targetEmail}`);
                      break;
                    }
                  }
                }
              } catch (dbError) {
                console.error(`Database lookup failed for user_id ${payload.user_id}:`, dbError.message);
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'db-notification', payload);
            }
          }
        } else if (msg.channel === 'ticket_comments') {
          const payload = JSON.parse(msg.payload);
          console.log(`Global ticket comment notification received for user ${payload.user_id}, ticket_row_id ${payload.ticket_row_id}`);
          
          // Get the ticket owner's user_id from the database
          try {
            const ticketResult = await globalNotificationClient.query(
              'SELECT user_id FROM tickets WHERE id = $1',
              [payload.ticket_row_id]
            );
            
            if (ticketResult.rows.length > 0) {
              const ticketOwnerId = ticketResult.rows[0].user_id;
              console.log(`Ticket owner ID: ${ticketOwnerId}, Comment author ID: ${payload.user_id}`);
              
              // Emit to both comment author and ticket owner (if different)
              const userIdsToNotify = [payload.user_id];
              if (ticketOwnerId !== payload.user_id) {
                userIdsToNotify.push(ticketOwnerId);
              }
              
              for (const userId of userIdsToNotify) {
                let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(userId)) {
                targetEmail = userData.email;
                break;
              }
            }
                
                if (targetEmail) {
                  emitToUserSockets(userId, targetEmail, 'ticket-comment', payload);
                }
              }
            }
          } catch (error) {
            console.error('Error getting ticket owner:', error);
          }
        } else if (msg.channel === 'health_check_events') {
          const payload = JSON.parse(msg.payload);
          console.log(`Health check event received:`, payload);
          
          // Use user_email from payload if available (optimized path)
          let targetEmail = payload.user_email;
          
          // Fallback to looking up by user_id if email not provided
          if (!targetEmail) {
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                break;
              }
            }
          }
          
          if (targetEmail) {
            emitToUserSockets(payload.user_id, targetEmail, 'health_check_event', payload);
          } 
        } else if (msg.channel === 'weekly_activity_change') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            
            // Find the user by database ID in the connected users
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                console.log(`Found user ${payload.user_id} with email ${targetEmail}`);
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'weekly-activity-update', payload);
            } 
          }
        } else if (msg.channel === 'activity_data_change') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'activity-data-updated', payload);
            }
          }
        } else if (msg.channel === 'monthly_activity_change') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.user_id) {
            let targetEmail = null;
            
            // Find the user by database ID in the connected users
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                console.log(`Found user ${payload.user_id} with email ${targetEmail}`);
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'monthly-activity-update', payload);
            }
          }
        } else if (msg.channel === 'meeting_status_change' || msg.channel === 'meeting-update') {
          const payload = JSON.parse(msg.payload);
          
          // Find all sockets for this user and emit to all of them
          if (payload.agent_user_id) {
            let targetEmail = null;
            
            // Find the user by database ID in the connected users
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.agent_user_id)) {
                targetEmail = userData.email;
                console.log(`Found user ${payload.agent_user_id} with email ${targetEmail}`);
                break;
              }
            }
            
            if (targetEmail) {
              // Invalidate Redis cache for this user's meeting data
              try {
                const meetingsCacheKey = `meetings:${payload.agent_user_id}:7`;
                const statusCacheKey = `meeting-status:${payload.agent_user_id}:7`;
                await Promise.all([
                  redisClient.del(meetingsCacheKey),
                  redisClient.del(statusCacheKey)
                ]);
                console.log(`Invalidated Redis cache for user ${payload.agent_user_id}`);
              } catch (cacheError) {
                console.error('Error invalidating cache:', cacheError.message);
              }

              // Determine the event type based on the operation
              let eventType = 'meeting-update';
              if (payload.operation === 'meeting_ended') {
                eventType = 'meeting_ended';
              } else if (payload.is_in_meeting === true) {
                eventType = 'meeting_started';
              }
              
              // Create the meeting event payload
              const meetingEventPayload = {
                email: targetEmail,
                type: eventType,
                meeting: {
                  id: payload.meeting_id,
                  title: payload.title,
                  status: payload.status,
                  is_in_meeting: payload.is_in_meeting,
                  start_time: payload.start_time,
                  end_time: payload.end_time
                },
                timestamp: payload.timestamp
              };
              
              // Emit the meeting event
              emitToUserSockets(payload.agent_user_id, targetEmail, eventType, meetingEventPayload);
              
              // Also broadcast agent status update for meeting status changes
              if (payload.is_in_meeting !== undefined) {
                const agentStatusPayload = {
                  email: targetEmail,
                  isInMeeting: payload.is_in_meeting,
                  meetingId: payload.meeting_id,
                  timestamp: payload.timestamp
                };
                emitToUserSockets(payload.agent_user_id, targetEmail, 'agent-status-update', agentStatusPayload);
              }
            }
          }
        } else if (msg.channel === 'event_changes') {
          const payload = JSON.parse(msg.payload);
          
          // Broadcast to all connected users since events are visible to all
          
          // Emit to all connected sockets
          io.emit('event-change', {
            type: payload.type,
            eventId: payload.event_id,
            eventTitle: payload.event_title,
            eventDate: payload.event_date,
            startTime: payload.start_time,
            endTime: payload.end_time,
            location: payload.location,
            status: payload.status,
            createdBy: payload.created_by,
            data: payload.data,
            timestamp: new Date().toISOString()
          });
          
          // Also emit event-updated for status changes to ensure frontend updates
          if (payload.type === 'event_status_changed') {
            io.emit('event-updated', {
              eventId: payload.event_id,
              type: 'status_change',
              oldStatus: payload.old_status,
              newStatus: payload.new_status,
              timestamp: new Date().toISOString()
            });
          }
          
          // Invalidate Redis cache for events
          try {
            await redisClient.del('events:*');
            console.log('🗑️ Cleared events cache after event change');
          } catch (error) {
            console.error('Error clearing events cache:', error);
          }
          
        } else if (msg.channel === 'event_attendance_changes') {
          const payload = JSON.parse(msg.payload);
          
          // Find the user's email by looking through all connected users
          let targetEmail = null;
          for (const [socketId, userData] of connectedUsers.entries()) {
            if (String(userData.userId) === String(payload.user_id)) {
              targetEmail = userData.email;
              break;
            }
          }
          
          if (targetEmail) {
            const eventAttendancePayload = {
              type: payload.type,
              eventId: payload.event_id,
              userId: payload.user_id,
              isGoing: payload.is_going,
              isBack: payload.is_back,
              goingAt: payload.going_at,
              backAt: payload.back_at,
              eventData: payload.event_data,
              userData: payload.user_data,
              timestamp: new Date().toISOString()
            };
            emitToUserSockets(payload.user_id, targetEmail, 'event-attendance-change', eventAttendancePayload);
          }
          
          // Also broadcast to all users since event attendance affects event visibility
          io.emit('event-updated', {
            eventId: payload.event_id,
            type: 'attendance_change',
            timestamp: new Date().toISOString()
          });
          
          // Invalidate Redis cache for events
          try {
            await redisClient.del('events:*');
            console.log('🗑️ Cleared events cache after attendance change');
          } catch (error) {
            console.error('Error clearing events cache:', error);
          }
        } else if (msg.channel === 'announcements') {
          const payload = JSON.parse(msg.payload);
          console.log(`Announcement notification received:`, payload.type, `Announcement ID: ${payload.announcement_id}`);
          
          if (payload.type === 'announcement_sent' && payload.user_id) {
            // Send to specific user
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'announcement', payload);
            }
          } else if (payload.type === 'announcement_expired' && payload.user_id) {
            // Send expiration notification to specific user
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'announcement', payload);
            }
          } else if (payload.type === 'announcement_dismissed' && payload.user_id) {
            // Send dismissal confirmation to specific user
            let targetEmail = null;
            for (const [socketId, userData] of connectedUsers.entries()) {
              if (String(userData.userId) === String(payload.user_id)) {
                targetEmail = userData.email;
                break;
              }
            }
            
            if (targetEmail) {
              emitToUserSockets(payload.user_id, targetEmail, 'announcement', payload);
            }
          } else if (payload.type === 'announcement_change') {
            // Broadcast announcement changes to all users (for admin updates)
            io.emit('announcement', payload);
          }
        }
      } catch (error) {
        console.error('Error handling global notification:', error.message);
      }
    });
    
    globalNotificationClient.on('error', (error) => {
      console.error('Global notification client error:', error.message);
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
    console.error('Failed to initialize global notification listener:', error.message);
    scheduleGlobalNotificationRetry();
  }
}

function scheduleGlobalNotificationRetry() {
  if (globalNotificationRetryInterval) {
    clearInterval(globalNotificationRetryInterval);
  }
  
  console.log('Scheduling global notification listener retry in 5 seconds...');
  globalNotificationRetryInterval = setInterval(() => {
    console.log('Retrying global notification listener...');
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
      console.log('Global notification client connection is closed, reconnecting...');
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
      console.warn(`High database connections: ${poolStatus.total} total, ${poolStatus.idle} idle, ${poolStatus.waiting} waiting`);
    }
    
    // Log every 5 minutes for monitoring
    if (Date.now() % 300000 < 1000) { // Every 5 minutes
      console.log(`Database pool status: ${poolStatus.total} total, ${poolStatus.idle} idle, ${poolStatus.waiting} waiting`);
    }
  }
}, 60000);

// Monitor connection metrics every 5 minutes
setInterval(() => {
  const uptime = Date.now() - connectionMetrics.startTime;
  const errorRate = connectionMetrics.totalConnections > 0 
    ? (connectionMetrics.errors / connectionMetrics.totalConnections * 100).toFixed(2) 
    : 0;
  
  console.log(`📊 Connection Metrics:`, {
    active: connectionMetrics.activeConnections,
    total: connectionMetrics.totalConnections,
    disconnections: connectionMetrics.disconnections,
    errors: connectionMetrics.errors,
    errorRate: `${errorRate}%`,
    uptime: `${Math.floor(uptime / 1000)}s`
  });
  
  // Reset metrics if error rate is too high
  if (connectionMetrics.errors > 1000) {
    console.warn('⚠️ High error rate detected, resetting metrics');
    connectionMetrics.errors = 0;
    connectionMetrics.lastReset = Date.now();
  }
}, 300000); // Every 5 minutes // Check every minute

// Check for shift resets every 30 seconds
setInterval(async () => {
  try {
    // Check shift resets for all connected users
    for (const [email, userInfo] of userData.entries()) {
      if (userInfo && userInfo.userId) {
        const resetPerformed = await checkShiftReset(email, userInfo.userId);
        if (resetPerformed) {
          console.log(`Shift reset completed for user: ${email}`);
        }
      }
    }
  } catch (error) {
    console.error('Error in shift reset check interval:', error);
  }
}, 30000); // 30 seconds

// Connection health monitoring and reconnection logic
setInterval(async () => {
  const now = Date.now();
  const staleConnections = [];
  const disconnectedUsers = [];
  
  // Clean up stale connections in database
  await cleanupStaleConnections();
  
  // Check for stale connections (no heartbeat for 5 minutes - more lenient for Railway)
  for (const [socketId, userData] of connectedUsers.entries()) {
    const timeSinceLastHeartbeat = userData.lastHeartbeat ? (now - userData.lastHeartbeat) : 0;
    const timeSinceLastHealthCheck = userData.lastHealthCheck ? (now - userData.lastHealthCheck) : 0;
    const timeSinceLastActivity = userData.lastActivity ? (now - userData.lastActivity) : 0;
    
    // Consider stale if no heartbeat, health check, or activity for 5 minutes
    // This is more lenient to account for Railway's network conditions
    if (timeSinceLastHeartbeat > 300000 || timeSinceLastHealthCheck > 300000 || timeSinceLastActivity > 300000) {
      staleConnections.push(socketId);
      // Store user info for reconnection attempt
      if (userData.email) {
        disconnectedUsers.push({
          email: userData.email,
          userId: userData.userId,
          userInfo: userData.userInfo
        });
      }
    }
  }
  
  // Clean up stale connections
  staleConnections.forEach(socketId => {
    console.log(`🧹 Cleaning up stale connection: ${socketId}`);
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
    }
  });
  
  // Attempt to reconnect disconnected users
  if (disconnectedUsers.length > 0) {
    console.log(`🔄 Attempting to reconnect ${disconnectedUsers.length} disconnected users`);
    disconnectedUsers.forEach(user => {
      // Try to find if user has reconnected with a new socket
      const existingConnection = Array.from(connectedUsers.values()).find(u => u.email === user.email);
      if (!existingConnection) {
        // User hasn't reconnected, try to trigger reconnection
        console.log(`🔄 Triggering reconnection for user: ${user.email}`);
        // Emit a reconnection event to all sockets (client will handle filtering)
        io.emit('user-reconnect-needed', {
          email: user.email,
          userId: user.userId,
          reason: 'stale_connection'
        });
      }
    });
  }
  
  // Log connection health
  if (connectedUsers.size > 0) {
    console.log(`📊 Connection Health: ${connectedUsers.size} active, ${staleConnections.length} stale`);
  }
}, 30000); // Check every 30 seconds (more frequent for Railway)

// In-memory storage for testing (since PostgreSQL is not running)
const connectedUsers = new Map();
const userData = new Map(); // Store user activity data in memory
const userMeetingStatus = new Map(); // Store user meeting status in memory
const userShiftInfo = new Map(); // Store user shift information for shift-based resets
const disconnectedUsers = new Map(); // Store user data for potential reconnection after ping timeout

// Track user connections and online status
// REMOVED: Online status tracking functionality

// Keep track of active connections per user
const userConnections = new Map(); // Map<email, Set<socketId>>

// Connection pooling and limits
const connectionPool = {
  maxConnectionsPerUser: 3, // Maximum concurrent connections per user
  maxTotalConnections: 1000, // Maximum total connections
  connectionTimeouts: new Map(), // Track connection timeouts
  userConnectionLimits: new Map(), // Per-user connection limits
  isAtCapacity: () => connectionMetrics.activeConnections >= connectionPool.maxTotalConnections
};

// Connection quality thresholds
const qualityThresholds = {
  pingTimeoutWarning: 5, // Warn if ping timeout rate > 5%
  reconnectionWarning: 10, // Warn if reconnection rate > 10%
  connectionDurationWarning: 300000, // Warn if avg duration < 5 minutes
  maxConcurrentConnections: 3 // Max connections per user
};

// Track user online/offline status (based on login/logout, not socket connections)
const userStatus = new Map(); // Map<email, { status: 'online'|'offline', loginTime: Date, lastSeen: Date }>

// Enhanced connection metrics for monitoring
const connectionMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  disconnections: 0,
  errors: 0,
  reconnections: 0,
  startTime: Date.now(),
  lastReset: Date.now(),
  // New metrics
  averageConnectionDuration: 0,
  reconnectionRate: 0,
  pingTimeoutRate: 0,
  connectionQuality: {
    excellent: 0,    // < 1% ping timeouts
    good: 0,         // 1-5% ping timeouts
    fair: 0,         // 5-10% ping timeouts
    poor: 0          // > 10% ping timeouts
  },
  userConnectionHistory: new Map(), // Track per-user connection patterns
  connectionDurations: [], // Store recent connection durations
  pingTimeouts: 0,
  transportStats: {
    websocket: 0,
    polling: 0
  }
};

// Circuit breaker for error rate monitoring
const circuitBreaker = {
  isOpen: false,
  errorCount: 0,
  lastErrorTime: null,
  threshold: 10, // Max errors per window
  window: 60000, // 1 minute window
  timeout: 30000, // 30 seconds timeout when open
  lastReset: Date.now()
};

// Track detailed user status from all contexts
const userDetailedStatus = new Map(); // Map<email, { 
//   isInMeeting: boolean, 
//   isInBreak: boolean, 
//   isInRestroom: boolean, 
//   isInEvent: boolean, 
//   isGoingToClinic: boolean, 
//   isInClinic: boolean,
//   currentMeeting: object | null,
//   currentEvent: object | null,
//   currentHealthRequest: object | null,
//   lastUpdated: Date
// }>

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

    // Get current time in Manila timezone for proper date calculation
    const nowManila = new Date(referenceDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const today = new Date(nowManila);
    today.setSeconds(0, 0); // Reset seconds and milliseconds

    const startTime = parseTimeString(startTimeStr, today);
    let endTime = parseTimeString(endTimeStr, today);

    

    // If end time is before start time, it means shift crosses midnight
    const isNightShift = endTime <= startTime;
    if (isNightShift) {
      // For night shifts, we need to determine which shift period we're in
      const now = new Date(referenceDate);
      
      // Check if we're currently before or after the end time today
      const endTimeToday = new Date(endTime);
      const startTimeToday = new Date(startTime);
      
      if (now <= endTimeToday) {
        // We're before the end time today, so we're in the shift that started yesterday
        const startTimeYesterday = new Date(startTime);
        startTimeYesterday.setDate(startTimeYesterday.getDate() - 1);
        
        return {
          period: "Night Shift",
          schedule: "",
          time: shiftTimeString,
          startTime: startTimeYesterday,
          endTime: endTimeToday,
          isNightShift
        };
      } else {
        // We're after the end time today, so we're either:
        // 1. In the shift that started today (if we're after start time)
        // 2. Between shifts (if we're before start time)
        
        if (now >= startTimeToday) {
          // We're in the shift that started today
          const endTimeTomorrow = new Date(endTime);
          endTimeTomorrow.setDate(endTimeTomorrow.getDate() + 1);
          
          return {
            period: "Night Shift",
            schedule: "",
            time: shiftTimeString,
            startTime: startTimeToday,
            endTime: endTimeTomorrow,
            isNightShift
          };
        } else {
          // We're between shifts - return the most recent completed shift
          const startTimeYesterday = new Date(startTime);
          startTimeYesterday.setDate(startTimeYesterday.getDate() - 1);
          
          return {
            period: "Night Shift",
            schedule: "",
            time: shiftTimeString,
            startTime: startTimeYesterday,
            endTime: endTimeToday,
            isNightShift
          };
        }
      }
    }

    // Day shift - simple same-day logic
    const result = {
      period: "Day Shift",
      schedule: "",
      time: shiftTimeString,
      startTime,
      endTime,
      isNightShift: false
    };
    
    
    
    return result;
  } catch (error) {
    console.error('Error parsing shift time:', error);
    return null;
  }
}

function parseTimeString(timeStr, baseDate) {
  const cleanTimeStr = timeStr.trim();
  const [time, period] = cleanTimeStr.split(/\s+/);
  const [hours, minutes] = time.split(':').map(Number);

  // Convert to 24-hour format
  let hour24 = hours;
  if (period?.toUpperCase() === 'PM' && hours !== 12) {
    hour24 += 12;
  } else if (period?.toUpperCase() === 'AM' && hours === 12) {
    hour24 = 0;
  }

  // Create a date string in Manila timezone format
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  const hour = String(hour24).padStart(2, '0');
  const minute = String(minutes).padStart(2, '0');
  
  // Create ISO string for Manila timezone (UTC+8)
  const manilaTimeString = `${year}-${month}-${day}T${hour}:${minute}:00+08:00`;
  const utcTime = new Date(manilaTimeString);
  
  
  
  return utcTime;
}

// Function to check if current time has passed shift start time since last activity
function shouldResetForShift(lastActivityTime, currentTime, shiftInfo) {
  // Ensure lastActivityTime is a Date object
  let lastActivityDate;
  if (!lastActivityTime) {
    // If no last activity time, treat as new day
    return true;
  } else if (typeof lastActivityTime === 'string') {
    lastActivityDate = new Date(lastActivityTime);
  } else if (lastActivityTime instanceof Date) {
    lastActivityDate = lastActivityTime;
  } else {
    // If it's neither string nor Date, treat as new day
    console.warn('Invalid lastActivityTime type:', typeof lastActivityTime, lastActivityTime);
    return true;
  }

  // Validate the date
  if (isNaN(lastActivityDate.getTime())) {
    console.warn('Invalid lastActivityTime value:', lastActivityTime);
    return true;
  }

  if (!shiftInfo) {
    // Fallback to daily reset if no shift info
    // Use Manila time-based date comparison to avoid timezone issues
    const lastDate = new Date(lastActivityDate.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const currentDate = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    return lastDate !== currentDate;
  }

  try {
    if (shiftInfo.isNightShift) {
      // NIGHT SHIFT LOGIC: Only reset when we start a completely new night shift
      // A night shift continues until the end time (7 AM), then resets at the next start time (10 PM)
      
      // Get the current shift start time (when the current night shift started)
      const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
      
      // Get the last shift start time (when the last recorded activity's night shift started)
      const lastShiftStart = getShiftStartForDate(lastActivityDate, shiftInfo);
      
      // For night shifts, we only reset when we move to a completely new night shift period
      // This means the last activity was from a different night shift start time
      const shouldReset = lastShiftStart.getTime() !== currentShiftStart.getTime();
      
      return shouldReset;
    } else {
      // DAY SHIFT LOGIC: Reset daily at shift start time
      // Compute the start boundary for the shift window that the CURRENT time belongs to
      const currentShiftStart = getShiftStartForDate(currentTime, shiftInfo);
      
      // FIXED: Check if this is a NEW DAY's shift, not just continuing the same shift
      // Get the date of the last activity and current time in Manila timezone
      const lastActivityDateStr = new Date(lastActivityDate.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      const currentDate = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      
      // FIXED: Only reset when we're on a completely NEW DAY
      // Don't reset when continuing the same shift on the same day
      const isNewDay = lastActivityDateStr !== currentDate;
      
      if (isNewDay) {
        return true;
      }
      // If it's the same day, don't reset - continue accumulating time
      return false;
    }
  } catch (error) {
    console.error('Error in shouldResetForShift:', error);
    // Fallback to daily reset on error
    const lastDate = new Date(lastActivityDate.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
    const currentDate = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
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
      const currentTime = new Date();
      const shiftInfo = parseShiftTime(shiftData.shift_time, currentTime);
      
      if (shiftInfo) {
        shiftInfo.period = shiftData.shift_period || shiftInfo.period;
        shiftInfo.schedule = shiftData.shift_schedule || shiftInfo.schedule;
        return shiftInfo;
      }
    }
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
    console.log(`Found ${teamResult.rows.length} team members to initialize`);
    
    // Initialize userStatus for all team members (default to offline)
    for (const row of teamResult.rows) {
      const email = row.email;
      if (!userStatus.has(email)) {
        userStatus.set(email, {
          status: 'offline',
          loginTime: null,
          lastSeen: null
        });
        console.log(`Initialized offline status for: ${email}`);
      }
    }
    
    console.log(`Team user status initialization completed for ${teamResult.rows.length} members`);
  } catch (error) {
    console.error('Error initializing team user status:', error);
  }
}

// Function to get all connected users with their status
async function getConnectedUsersList() {
  try {
    console.log('Fetching connected users list...');
    
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
      console.log('No reference user found, returning empty list');
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
        console.log('Reference user is not an agent, returning empty list');
        return [];
      }
      
             referenceMemberId = memberResult.rows[0].member_id;
       console.log(`Found reference member_id: ${referenceMemberId}`);
       
       // Initialize user status for all team members
       await initializeTeamUserStatus(referenceMemberId);
     } catch (error) {
       console.error('Error getting reference member_id:', error);
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
        // Get detailed status for this user
        const detailedStatus = getUserDetailedStatus(email);
        
        users.push({
          id: userId,
          email: email,
          name: fullName,
          status: socketStatus.status,
          lastSeen: socketStatus.lastSeen?.toISOString(),
          loginTime: socketStatus.loginTime?.toISOString(),
          detailedStatus: detailedStatus
        });
        console.log(`User ${email} has socket status: ${socketStatus.status}`);
      } else {
        // User doesn't have socket status - mark as offline
        const detailedStatus = getUserDetailedStatus(email);
        
        users.push({
          id: userId,
          email: email,
          name: fullName,
          status: 'offline',
          lastSeen: null,
          loginTime: null,
          detailedStatus: detailedStatus
        });
        console.log(`User ${email} has no socket status - marked as offline`);
      }
    }
    
    return users;
    
  } catch (error) {
    console.error('Error in getConnectedUsersList:', error);
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

// Function to update detailed user status
function updateUserDetailedStatus(email, statusUpdate) {
  if (!userDetailedStatus.has(email)) {
    userDetailedStatus.set(email, {
      isInMeeting: false,
      isInBreak: false,
      isInRestroom: false,
      isInEvent: false,
      isGoingToClinic: false,
      isInClinic: false,
      currentMeeting: null,
      currentEvent: null,
      currentHealthRequest: null,
      lastUpdated: new Date()
    });
  }
  
  const currentStatus = userDetailedStatus.get(email);
  const updatedStatus = {
    ...currentStatus,
    ...statusUpdate,
    lastUpdated: new Date()
  };
  
  userDetailedStatus.set(email, updatedStatus);
  
  // Broadcast the detailed status update to all clients
  broadcastDetailedStatusUpdate(email, updatedStatus);
}

// Function to broadcast detailed status update to all clients
function broadcastDetailedStatusUpdate(email, detailedStatus) {
  // Get user info for display
  const userInfo = userData.get(email);
  const userId = userInfo?.userId || email;
  
  // Broadcast to all clients
  io.emit('user-detailed-status-update', {
    id: userId,
    email: email,
    name: userInfo?.name || email,
    status: userStatus.get(email)?.status || 'offline',
    loginTime: userStatus.get(email)?.loginTime?.toISOString(),
    lastSeen: userStatus.get(email)?.lastSeen?.toISOString(),
    detailedStatus: detailedStatus,
    timestamp: new Date().toISOString()
  });
  
  console.log(`Broadcasted detailed status update for ${email}`);
}

// Function to get detailed status for a user
function getUserDetailedStatus(email) {
  return userDetailedStatus.get(email) || {
    isInMeeting: false,
    isInBreak: false,
    isInRestroom: false,
    isInEvent: false,
    isGoingToClinic: false,
    isInClinic: false,
    currentMeeting: null,
    currentEvent: null,
    currentHealthRequest: null,
    lastUpdated: new Date()
  };
}

// Function to check if shift reset is needed for a user
async function checkShiftReset(email, userId) {
  try {
    const userInfo = userData.get(email);
    if (!userInfo) {
      return false;
    }

    const shiftInfo = userShiftInfo.get(email);
    if (!shiftInfo) {
      return false;
    }

    const currentTime = new Date();
    const currentShiftId = getCurrentShiftId(currentTime, shiftInfo);

    // FIRST: Check if we should reset based on shift schedule
    // This is the primary logic that determines if a reset is needed
    const shouldReset = shouldResetForShift(userInfo.sessionStart, currentTime, shiftInfo);
    
    if (!shouldReset) {
      return false; // No reset needed based on shift schedule
    }

    // SECOND: Apply safety checks only AFTER we know a reset is needed
    // This prevents false resets while allowing legitimate ones
    
    // Check if we already reset recently for the same shift period
    if (userInfo.lastResetAt && userInfo.lastShiftId === currentShiftId) {
      const timeSinceLastReset = Date.now() - userInfo.lastResetAt;
      // Only prevent reset if it was very recent (less than 5 minutes)
      if (timeSinceLastReset < 300000) { // 5 minutes
        return false;
      }
    }
    
    // If we reach here, a reset is needed and safe to perform
    console.log(`Performing shift reset for ${email} - new shift period detected:`, {
      lastShiftId: userInfo.lastShiftId,
      currentShiftId: currentShiftId,
      sessionStart: userInfo.sessionStart,
      activeSeconds: userInfo.activeSeconds,
      inactiveSeconds: userInfo.inactiveSeconds
    });
    
    // FIXED: For a new shift, always start as active
    // This ensures users start productive work at the beginning of each shift
    let preserveActive = true;
    
    // For new shifts, always force active state for productivity
    if (shiftInfo && shouldReset) {
      preserveActive = true;
    }
    
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
      } else {
        // For day shifts, use current Manila time (not UTC)
        // Convert UTC to Manila time by adding 8 hours (UTC+8)
        const manilaTime = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000));
        currentDate = manilaTime.toISOString().split('T')[0];
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
      } 
      
      return true;
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
    const shiftEndTime = new Date(shiftInfo.endTime);
    
    // Set the date but keep the time from shift start
    shiftDate.setHours(
      shiftStartTime.getHours(),
      shiftStartTime.getMinutes(),
      0, 0
    );

    if (shiftInfo.isNightShift) {
      // For night shifts, we need to determine which shift period we're in
      // Create a temporary date with the shift start time for today
      const todayShiftStart = new Date(shiftDate);
      
      // Create a temporary date with the shift end time for today
      const todayShiftEnd = new Date(date);
      todayShiftEnd.setHours(
        shiftEndTime.getHours(),
        shiftEndTime.getMinutes(),
        0, 0
      );
      
      // For night shifts, if end time is before start time, add one day to end time
      if (todayShiftEnd <= todayShiftStart) {
        todayShiftEnd.setDate(todayShiftEnd.getDate() + 1);
      }
      
      // For night shifts, if we're before the shift start time today,
      // we're still in the shift that started yesterday
      if (date < todayShiftStart) {
        // We're in the shift that started the previous day
        shiftDate.setDate(shiftDate.getDate() - 1);
        return shiftDate;
      } else if (date <= todayShiftEnd) {
        // We're between shift start and shift end on the same day
        return shiftDate;
      } else {
        // We're after shift end, so we're in the shift that started today
        return shiftDate;
      }
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

// Socket connection database management functions
async function storeSocketConnection(socketId, userId, email, userAgent, ipAddress, transport = 'websocket') {
  try {
    if (!isPoolAvailable()) {
      console.warn('Database pool not available, skipping socket connection storage');
      return false;
    }

    const query = `
      INSERT INTO socket_connections (user_id, socket_id, email, user_agent, ip_address, transport, connection_status)
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      ON CONFLICT (socket_id) 
      DO UPDATE SET 
        user_id = EXCLUDED.user_id,
        email = EXCLUDED.email,
        user_agent = EXCLUDED.user_agent,
        ip_address = EXCLUDED.ip_address,
        transport = EXCLUDED.transport,
        connection_status = 'active',
        connected_at = NOW(),
        last_heartbeat = NOW(),
        disconnected_at = NULL,
        updated_at = NOW()
    `;

    await pool.query(query, [userId, socketId, email, userAgent, ipAddress, transport]);
    console.log(`✅ Stored socket connection ${socketId} for user ${email} (ID: ${userId})`);
    return true;
  } catch (error) {
    console.error(`❌ Error storing socket connection ${socketId}:`, error.message);
    return false;
  }
}

async function updateSocketHeartbeat(socketId) {
  try {
    if (!isPoolAvailable()) {
      return false;
    }

    const query = `
      UPDATE socket_connections 
      SET last_heartbeat = NOW(), updated_at = NOW()
      WHERE socket_id = $1 AND connection_status = 'active'
    `;

    await pool.query(query, [socketId]);
    return true;
  } catch (error) {
    console.error(`❌ Error updating socket heartbeat ${socketId}:`, error.message);
    return false;
  }
}

async function disconnectSocket(socketId, reason = 'disconnect') {
  try {
    if (!isPoolAvailable()) {
      return false;
    }

    const query = `
      UPDATE socket_connections 
      SET 
        connection_status = CASE 
          WHEN $2 = 'ping timeout' THEN 'timeout'
          ELSE 'disconnected'
        END,
        disconnected_at = NOW(),
        updated_at = NOW()
      WHERE socket_id = $1
    `;

    const result = await pool.query(query, [socketId, reason]);
    console.log(`✅ Marked socket ${socketId} as disconnected (reason: ${reason})`);
    return result.rowCount > 0;
  } catch (error) {
    console.error(`❌ Error disconnecting socket ${socketId}:`, error.message);
    return false;
  }
}

async function getUserBySocketId(socketId) {
  try {
    if (!isPoolAvailable()) {
      return null;
    }

    const query = `
      SELECT sc.*, u.email as user_email, 
             COALESCE(pi.first_name || ' ' || pi.last_name, u.email) as full_name
      FROM socket_connections sc
      JOIN users u ON sc.user_id = u.id
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE sc.socket_id = $1 AND sc.connection_status = 'active'
    `;

    const result = await pool.query(query, [socketId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error(`❌ Error getting user by socket ID ${socketId}:`, error.message);
    return null;
  }
}

async function getActiveConnectionsForUser(email) {
  try {
    if (!isPoolAvailable()) {
      return [];
    }

    const query = `
      SELECT socket_id, connected_at, last_heartbeat, transport
      FROM socket_connections 
      WHERE email = $1 AND connection_status = 'active'
      ORDER BY connected_at DESC
    `;

    const result = await pool.query(query, [email]);
    return result.rows;
  } catch (error) {
    console.error(`❌ Error getting active connections for ${email}:`, error.message);
    return [];
  }
}

async function cleanupStaleConnections() {
  try {
    if (!isPoolAvailable()) {
      return 0;
    }

    // Mark connections as timeout if they haven't had a heartbeat in 5 minutes
    const query = `
      UPDATE socket_connections 
      SET connection_status = 'timeout', disconnected_at = NOW(), updated_at = NOW()
      WHERE connection_status = 'active' 
        AND last_heartbeat < NOW() - INTERVAL '5 minutes'
    `;

    const result = await pool.query(query);
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} stale socket connections`);
    }
    return result.rowCount;
  } catch (error) {
    console.error(`❌ Error cleaning up stale connections:`, error.message);
    return 0;
  }
}

// Enhanced connection validation
async function validateConnection(socketId) {
  try {
    // First check memory
    if (connectedUsers.has(socketId)) {
      return { valid: true, source: 'memory', data: connectedUsers.get(socketId) };
    }

    // Fallback to database
    const dbConnection = await getUserBySocketId(socketId);
    if (dbConnection && dbConnection.connection_status === 'active') {
      return { valid: true, source: 'database', data: dbConnection };
    }

    return { valid: false, source: 'none', data: null };
  } catch (error) {
    console.error(`❌ Error validating connection ${socketId}:`, error.message);
    return { valid: false, source: 'error', data: null };
  }
}

// Connection quality assessment
function assessConnectionQuality(userEmail) {
  const userHistory = connectionMetrics.userConnectionHistory.get(userEmail);
  if (!userHistory) return 'unknown';

  const { totalConnections, pingTimeouts, reconnections } = userHistory;
  const pingTimeoutRate = totalConnections > 0 ? (pingTimeouts / totalConnections) * 100 : 0;

  if (pingTimeoutRate < 1) return 'excellent';
  if (pingTimeoutRate < 5) return 'good';
  if (pingTimeoutRate < 10) return 'fair';
  return 'poor';
}

// Update connection metrics
function updateConnectionMetrics(socketId, event, data = {}) {
  const userData = connectedUsers.get(socketId);
  if (!userData) return;

  const email = userData.email;
  
  // Initialize user history if not exists
  if (!connectionMetrics.userConnectionHistory.has(email)) {
    connectionMetrics.userConnectionHistory.set(email, {
      totalConnections: 0,
      pingTimeouts: 0,
      reconnections: 0,
      averageDuration: 0,
      lastConnection: null,
      connectionStartTimes: new Map()
    });
  }

  const userHistory = connectionMetrics.userConnectionHistory.get(email);

  switch (event) {
    case 'connect':
      userHistory.totalConnections++;
      userHistory.connectionStartTimes.set(socketId, Date.now());
      userHistory.lastConnection = new Date();
      
      // Track transport type
      const transport = data.transport || 'websocket';
      connectionMetrics.transportStats[transport]++;
      break;

    case 'disconnect':
      const startTime = userHistory.connectionStartTimes.get(socketId);
      if (startTime) {
        const duration = Date.now() - startTime;
        userHistory.connectionStartTimes.delete(socketId);
        
        // Update average duration (keep last 100 connections)
        connectionMetrics.connectionDurations.push(duration);
        if (connectionMetrics.connectionDurations.length > 100) {
          connectionMetrics.connectionDurations.shift();
        }
        
        userHistory.averageDuration = connectionMetrics.connectionDurations.reduce((a, b) => a + b, 0) / connectionMetrics.connectionDurations.length;
      }
      break;

    case 'ping_timeout':
      userHistory.pingTimeouts++;
      connectionMetrics.pingTimeouts++;
      break;

    case 'reconnect':
      userHistory.reconnections++;
      connectionMetrics.reconnections++;
      break;
  }

  // Update global metrics
  connectionMetrics.averageConnectionDuration = connectionMetrics.connectionDurations.length > 0 
    ? connectionMetrics.connectionDurations.reduce((a, b) => a + b, 0) / connectionMetrics.connectionDurations.length 
    : 0;

  connectionMetrics.reconnectionRate = connectionMetrics.totalConnections > 0 
    ? (connectionMetrics.reconnections / connectionMetrics.totalConnections) * 100 
    : 0;

  connectionMetrics.pingTimeoutRate = connectionMetrics.totalConnections > 0 
    ? (connectionMetrics.pingTimeouts / connectionMetrics.totalConnections) * 100 
    : 0;

  // Update connection quality
  const quality = assessConnectionQuality(email);
  connectionMetrics.connectionQuality[quality]++;
}

io.on('connection', (socket) => {
  console.log(`🔌 New socket connection: ${socket.id} (transport: ${socket.conn.transport.name})`);
  
  // Check capacity limits
  if (connectionPool.isAtCapacity()) {
    console.log(`⚠️ Server at capacity, rejecting connection ${socket.id}`);
    socket.emit('server-full', { message: 'Server is at capacity, please try again later' });
    socket.disconnect(true);
    return;
  }
  
  // Update connection metrics
  connectionMetrics.totalConnections++;
  connectionMetrics.activeConnections++;
  
  // Track connection start time
  connectionPool.connectionTimeouts.set(socket.id, Date.now());
  
  // Monitor connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle ping timeout specifically
  socket.on('disconnect', (reason) => {
    if (reason === 'ping timeout') {
      console.log(`🔌 Socket ${socket.id} disconnected due to ping timeout - attempting graceful reconnection`);
      // Don't immediately clean up, give client time to reconnect
      setTimeout(() => {
        if (!socket.connected) {
          console.log(`🔌 Socket ${socket.id} still disconnected after timeout grace period`);
        }
      }, 10000); // 10 second grace period
    }
  });
  
  // Handle connection errors
  socket.on('error', (error) => {
    console.error(`Socket ${socket.id} error:`, error.message);
    connectionMetrics.errors++;
    
    // Update circuit breaker
    circuitBreaker.errorCount++;
    circuitBreaker.lastErrorTime = Date.now();
    
    // Check if circuit should open
    if (circuitBreaker.errorCount >= circuitBreaker.threshold && 
        Date.now() - circuitBreaker.lastReset < circuitBreaker.window) {
      circuitBreaker.isOpen = true;
      console.warn('🚨 Circuit breaker OPEN - too many errors detected');
      
      // Close circuit after timeout
      setTimeout(() => {
        circuitBreaker.isOpen = false;
        circuitBreaker.errorCount = 0;
        circuitBreaker.lastReset = Date.now();
        console.log('🔄 Circuit breaker CLOSED - attempting recovery');
      }, circuitBreaker.timeout);
    }
  });

  // Enhanced heartbeat mechanism for active connection monitoring
  socket.on('heartbeat', async () => {
    // Validate connection before processing
    const validation = await validateConnection(socket.id);
    if (!validation.valid) {
      console.log(`⚠️ Invalid connection ${socket.id} attempting heartbeat`);
      socket.disconnect(true);
      return;
    }

    socket.emit('heartbeat-ack');
    // Update last seen timestamp for this socket
    if (connectedUsers.has(socket.id)) {
      const userData = connectedUsers.get(socket.id);
      userData.lastHeartbeat = Date.now();
      userData.heartbeatCount = (userData.heartbeatCount || 0) + 1;
      
      // Update heartbeat in database
      await updateSocketHeartbeat(socket.id);
    }
  });

  // Handle heartbeat acknowledgment
  socket.on('heartbeat-ack', () => {
    // Connection is healthy
    if (connectedUsers.has(socket.id)) {
      const userData = connectedUsers.get(socket.id);
      userData.lastHeartbeatAck = Date.now();
      userData.heartbeatAckCount = (userData.heartbeatAckCount || 0) + 1;
    }
  });

  // Add connection health monitoring
  socket.on('connection-health', (data) => {
    if (connectedUsers.has(socket.id)) {
      const userData = connectedUsers.get(socket.id);
      userData.lastHealthCheck = Date.now();
      userData.clientHealth = data;
    }
  });

  // Note: Removed precreateNextDayRowIfEnded function as it was causing incorrect row creation for night shifts
  // The proper shift end detection is now handled in the main timer logic

      // Handle user authentication
   socket.on('authenticate', async (data) => {
      const startTime = Date.now();
      console.log(`AUTHENTICATE EVENT RECEIVED from socket ${socket.id}:`, data);
      
      // Handle both object format { email } and direct email string
      const email = typeof data === 'string' ? data : data?.email;
      
      // Initialize variables that need to be accessible in catch block
      let authTimeout = null;
      let emailString = '';
      
      try {
       if (!email || typeof email !== 'string') {
         console.log('Authentication failed: Invalid email format');
         socket.emit('error', { message: 'Valid email string is required' });
         return;
       }
       
       console.log(`Authenticating user with email: ${email}`);
      
      // Get or create user data
      emailString = String(email);
      
      // Check if this user was recently disconnected due to ping timeout
      if (disconnectedUsers.has(emailString)) {
        const disconnectedUserData = disconnectedUsers.get(emailString);
        console.log(`🔄 User ${emailString} reconnecting after ping timeout - restoring data`);
        
        // Remove from disconnected users
        disconnectedUsers.delete(emailString);
        
        // Restore user data
        userData.set(emailString, disconnectedUserData.userInfo);
        userShiftInfo.set(emailString, disconnectedUserData.userInfo.shiftInfo);
        
        console.log(`✅ User ${emailString} data restored from ping timeout disconnection`);
      }
      
      // Check if authentication is already in progress for this user
      if (authenticationInProgress.has(emailString)) {
        console.log(`Authentication already in progress for: ${emailString}, waiting...`);
        try {
          await authenticationInProgress.get(emailString);
          // After waiting, get the user data and send response
          const userInfo = userData.get(emailString);
          if (userInfo) {
            // Add this socket to connectedUsers map with user name
            const userResult = await pool.query(
              'SELECT u.id, COALESCE(pi.first_name || \' \' || pi.last_name, u.email) as full_name FROM users u LEFT JOIN personal_info pi ON u.id = pi.user_id WHERE u.email = $1',
              [emailString]
            );
            const fullName = userResult.rows[0]?.full_name || emailString;
            
            connectedUsers.set(socket.id, { 
              userId: userInfo.userId, 
              email: emailString, 
              userInfo,
              fullName 
            });
            console.log(`AUTHENTICATION COMPLETED (waited): Socket ${socket.id} now associated with user ${emailString}`);
            // User data retrieved after waiting
            
            const initialTimerData = {
              userId: userInfo.userId, // Include userId in authenticated response
              isActive: userInfo.isActive,
              activeSeconds: userInfo.activeSeconds,
              inactiveSeconds: userInfo.inactiveSeconds,
              sessionStart: userInfo.sessionStart
            };
            socket.emit('authenticated', initialTimerData);
            console.log(`Authentication completed (waited) for ${emailString}`);
          }
        } catch (error) {
          console.log(`Authentication wait failed for ${emailString}:`, error.message);
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
        console.error(`Authentication timeout for ${emailString} - cleaning up`);
        rejectAuth(new Error('Authentication timeout'));
        authenticationInProgress.delete(emailString);
        socket.emit('error', { message: 'Authentication timeout' });
      }, 10000); // 10 second timeout
      
      console.log(`Looking up user data for: ${emailString}`);
      let userInfo = userData.get(emailString);
      if (!userInfo) {
        console.log(`Creating new user data for: ${emailString}`);
        // Creating new user data;
        userInfo = {
          userId: null, // Will be set after database lookup
          isActive: true, // FIXED: Start as active by default for productivity
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
          console.log(`Getting shift info for user ID: ${userId}`);
          const shiftInfo = await getUserShiftInfo(userId);
          userShiftInfo.set(emailString, shiftInfo);
          
          if (shiftInfo) {
            console.log(`User ${emailString} has ${shiftInfo.period} schedule: ${shiftInfo.time}`);
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
             // For day shifts, use current Manila time (not UTC)
             // Convert UTC to Manila time by adding 8 hours (UTC+8)
             currentDate = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
           }
          
          // First check if there's any activity data for this user
          console.log(`Loading activity data for user ${emailString} (ID: ${userId})`);
          
          // PRIORITY: First try to get current day's data, then fall back to most recent
          // Extract date parts and compare since dates are stored as JavaScript Date objects
          let activityResult = await pool.query(
            `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
             FROM activity_data 
             WHERE user_id = $1 AND EXTRACT(YEAR FROM today_date) = EXTRACT(YEAR FROM $2::date) 
             AND EXTRACT(MONTH FROM today_date) = EXTRACT(MONTH FROM $2::date)
             AND EXTRACT(DAY FROM today_date) = EXTRACT(DAY FROM $2::date)`,
            [userId, currentDate]
          );
          
          // If no current day data, get the most recent data as fallback
          if (activityResult.rows.length === 0) {
            console.log(`No current day (${currentDate}) data found for ${emailString}, checking for most recent data...`);
            activityResult = await pool.query(
              `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
               FROM activity_data 
               WHERE user_id = $1 
               ORDER BY today_date DESC 
               LIMIT 1`,
              [userId]
            );
          } else {
            console.log(`Found current day (${currentDate}) data for ${emailString}`);
          }
          console.log(`Activity query for user ${emailString} (ID: ${userId}) returned ${activityResult.rows.length} rows`);
          
          if (activityResult.rows.length > 0) {
            const dbData = activityResult.rows[0];
            const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
            let lastActivityTime = dbData.last_session_start ? new Date(dbData.last_session_start) : new Date(dbData.today_date);
            
            // Validate the date object
            if (isNaN(lastActivityTime.getTime())) {
              console.warn(`Invalid lastActivityTime for ${emailString}, using today_date instead`);
              lastActivityTime = new Date(dbData.today_date);
            }
            
            console.log(`User ${emailString} (ID: ${userId}) - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
            
            // Check if we should reset based on shift schedule
            // FIXED: Use the database session start time to determine if reset is needed
            const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
            
            if (!shouldReset) {
              // Same shift period - use existing values
              if (shiftInfo) {
                console.log(`Same shift period detected for ${emailString} (${shiftInfo.period}) - loading existing timer data`);
              } else {
                console.log(`Same day detected for ${emailString} - loading existing timer data`);
              }
              userInfo.activeSeconds = dbData.today_active_seconds || 0;
              userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
              userInfo.isActive = dbData.is_currently_active || false;
              userInfo.sessionStart = dbData.last_session_start || new Date().toISOString();
              // FIXED: Initialize lastShiftBoundaryTime for existing users loaded from database
              if (!userInfo.lastShiftBoundaryTime) {
                userInfo.lastShiftBoundaryTime = userInfo.sessionStart;
              }
              
              // CRITICAL: Preserve reset tracking to prevent multiple resets
              if (shiftInfo) {
                const currentShiftId = getCurrentShiftId(currentTime, shiftInfo);
                // If we don't have reset tracking, initialize it based on current state
                if (!userInfo.lastShiftId) {
                  userInfo.lastShiftId = currentShiftId;
                  console.log(`Initializing reset tracking for ${emailString} with shift ID: ${currentShiftId}`);
                }
                // If we don't have reset timestamp, set it to prevent immediate reset
                if (!userInfo.lastResetAt) {
                  userInfo.lastResetAt = Date.now();
                  console.log(`Initializing reset timestamp for ${emailString} to prevent immediate reset`);
                }
              }
              
              // Ensure lastDbUpdate field exists for throttling
              if (typeof userInfo.lastDbUpdate === 'undefined') {
                userInfo.lastDbUpdate = 0;
              }
              
              // Initialize throttling fields
              userInfo.lastDbUpdate = 0;
              userInfo.lastSocketEmit = 0;
              userInfo.lastActivityEmit = 0;
            } else {
              // New shift period - reset timers
              if (shiftInfo) {
                console.log(`New shift period detected for ${emailString} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
              } else {
                console.log(`New day detected for ${emailString} (${dbDate} -> ${currentDate}) - resetting timers`);
              }
              // FIXED: For a new shift, always start as active
              // This ensures users start productive work at the beginning of each shift
              let preserveActive = true;
              
              // For new shifts, always force active state for productivity
              if (shiftInfo && shouldReset) {
                console.log(`New shift detected - forcing active state for productivity`);
                preserveActive = true;
              }
              
              console.log(`Shift reset: Activity state change for ${email}: ${userInfo.isActive} → ${preserveActive}`);
              
              // Reset user data
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
                 VALUES ($1, $4, 0, 0, $2, $3::date, NOW())
                 ON CONFLICT (user_id, today_date)
                 DO UPDATE SET
                   is_currently_active = EXCLUDED.is_currently_active,
                   today_active_seconds = 0,
                   today_inactive_seconds = 0,
                   last_session_start = EXCLUDED.last_session_start,
                   updated_at = NOW()`,
                [userId, userInfo.sessionStart, currentDate, preserveActive]
              );
              console.log(`Created new activity record for ${email} on ${currentDate}`);
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
                console.log(`User ${email} logging in after shift start time (${shiftInfo.time}) - resetting timers`);
              }
            }
            
            if (shouldResetForNewUser) {
              // Reset timers for user logging in after shift start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              // FIXED: Start as active if shift has started, unless explicitly set to inactive
              userInfo.isActive = true; // Start as active for shift that has begun
              userInfo.sessionStart = new Date().toISOString();
              // FIXED: Update lastShiftBoundaryTime when fresh start reset occurs
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
              console.log(`Fresh start with reset for ${email} - ${resetReason} - starting as ACTIVE`);
            } else {
              // Normal fresh start
              userInfo.activeSeconds = 0;
              userInfo.inactiveSeconds = 0;
              // FIXED: Start as active by default for new users, unless shift hasn't started
              userInfo.isActive = true; // Start as active by default
              userInfo.sessionStart = new Date().toISOString();
              // FIXED: Update lastShiftBoundaryTime for normal fresh start
              userInfo.lastShiftBoundaryTime = currentTime.toISOString();
              userInfo.lastResetAt = Date.now();
              userInfo.lastDbUpdate = 0; // Initialize for throttling
              userInfo.lastSocketEmit = 0; // Initialize for throttling
              userInfo.lastActivityEmit = 0; // Initialize for throttling
              console.log(`Fresh start for ${email} - no reset needed - starting as ACTIVE`);
            }
            
            // Create initial activity_data record
            await pool.query(
              `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
               VALUES ($1, $2, $3, $4, $5, $6::date, NOW())`,
              [userId, userInfo.isActive, 0, 0, userInfo.sessionStart, currentDate]
            );
          }
          
        } catch (dbError) {
          console.error('Database load failed:', dbError.message);
          // Using fresh start due to database error;
          // Continue with fresh start - don't throw error
        }
        
        userData.set(emailString, userInfo);
        console.log(`Stored new user data for: ${emailString}`);
      } else {
        console.log(`Found existing user data for: ${emailString}`);
        // Found existing user data;
        // Keep existing timer data - don't reset on reconnection
        // But also try to refresh from database to ensure we have latest data and check for new shift
        console.log(`Refreshing existing user data from database for: ${emailString}`);
        try {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [emailString]);
          if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            console.log(`Database user ID found: ${userId}`);
            
            // Get/refresh user shift information
            console.log(`Refreshing shift info for user ID: ${userId}`);
            const shiftInfo = await getUserShiftInfo(userId);
            userShiftInfo.set(emailString, shiftInfo);
            console.log(`Shift info refreshed for: ${emailString}`);
            
                         const currentTime = new Date();
             // For night shifts, use the date when the shift started (not current calendar date)
             let currentDate;
             if (shiftInfo && shiftInfo.isNightShift) {
               // For night shifts, use the date when the current shift started
               const shiftStartDate = getShiftStartForDate(currentTime, shiftInfo);
               currentDate = shiftStartDate.toISOString().split('T')[0];
               console.log(`🌙 Night shift refresh detected for ${emailString} - using shift start date: ${currentDate} (not current calendar date)`);
             } else {
               // For day shifts, use current Manila time (not UTC)
               // Convert UTC to Manila time by adding 8 hours (UTC+8)
               currentDate = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
             }
            
                        // Get the most recent activity data for this user
            console.log(`Loading most recent activity data for user ${emailString} (ID: ${userId})`);
            
            // PRIORITY: First try to get current day's data, then fall back to most recent
            // Use simple date comparison since dates are already stored in Manila time
            let activityResult = await pool.query(
              `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
               FROM activity_data 
               WHERE user_id = $1 AND DATE(today_date) = $2::date`,
              [userId, currentDate]
            );
            
            // If no current day data, get the most recent data as fallback
            if (activityResult.rows.length === 0) {
              console.log(`No current day (${currentDate}) data found during refresh for ${emailString}, checking for most recent data...`);
              activityResult = await pool.query(
                `SELECT today_active_seconds, today_inactive_seconds, last_session_start, is_currently_active, today_date
                 FROM activity_data 
                 WHERE user_id = $1 
                 ORDER BY today_date DESC
                 LIMIT 1`,
                [userId]
              );
            } else {
              console.log(`Found current day (${currentDate}) data during refresh for ${emailString}`);
            }
            console.log(`Activity query for user ${emailString} (ID: ${userId}) returned ${activityResult.rows.length} rows`);
            
            if (activityResult.rows.length > 0) {
              const dbData = activityResult.rows[0];
              const dbDate = dbData.today_date.toISOString().split('T')[0]; // Convert to YYYY-MM-DD format
              let lastActivityTime = dbData.last_session_start ? new Date(dbData.last_session_start) : new Date(dbData.today_date);
              
              // Validate the date object
              if (isNaN(lastActivityTime.getTime())) {
                console.warn(`Invalid lastActivityTime for ${emailString}, using today_date instead`);
                lastActivityTime = new Date(dbData.today_date);
              }
              
              console.log(`Refresh check for ${emailString} - Last Activity: ${lastActivityTime.toISOString()}, Current: ${currentTime.toISOString()}`);
              
              // Check if we should reset based on shift schedule
              const shouldReset = shouldResetForShift(lastActivityTime, currentTime, shiftInfo);
              
              if (!shouldReset) {
                // Same shift period - update with database data if it's more recent
                if (dbData.today_active_seconds > userInfo.activeSeconds || dbData.today_inactive_seconds > userInfo.inactiveSeconds) {
                  if (shiftInfo) {
                    console.log(`Updating memory data for ${emailString} with more recent database data (same shift period: ${shiftInfo.period})`);
                  } else {
                    console.log(`Updating memory data for ${emailString} with more recent database data`);
                  }
                  userInfo.activeSeconds = dbData.today_active_seconds || 0;
                  userInfo.inactiveSeconds = dbData.today_inactive_seconds || 0;
                  userInfo.isActive = dbData.is_currently_active || false;
                  userInfo.sessionStart = dbData.last_session_start || userInfo.sessionStart;
                  // FIXED: Initialize lastShiftBoundaryTime for existing users loaded from database
                  if (!userInfo.lastShiftBoundaryTime) {
                    userInfo.lastShiftBoundaryTime = userInfo.sessionStart;
                  }
                  
                  // CRITICAL: Preserve reset tracking to prevent multiple resets
                  if (shiftInfo) {
                    const currentShiftId = getCurrentShiftId(currentTime, shiftInfo);
                    // If we don't have reset tracking, initialize it based on current state
                    if (!userInfo.lastShiftId) {
                      userInfo.lastShiftId = currentShiftId;
                      console.log(`Initializing reset tracking for ${emailString} with shift ID: ${currentShiftId}`);
                    }
                    // If we don't have reset timestamp, set it to prevent immediate reset
                    if (!userInfo.lastResetAt) {
                      userInfo.lastResetAt = Date.now();
                      console.log(`Initializing reset timestamp for ${emailString} to prevent immediate reset`);
                    }
                  }
                  
                  // Ensure lastDbUpdate field exists for throttling
                  if (typeof userInfo.lastDbUpdate === 'undefined') {
                    userInfo.lastDbUpdate = 0;
                  }
                  
                  // Initialize throttling fields
                  userInfo.lastDbUpdate = 0;
                  userInfo.lastSocketEmit = 0;
                  userInfo.lastActivityEmit = 0;
                }
              } else {
              // New shift period - reset for new shift
                if (shiftInfo) {
                  console.log(`New shift period detected during refresh for ${emailString} (${shiftInfo.period}: ${shiftInfo.time}) - resetting timers`);
                } else {
                  console.log(`New day detected during refresh for ${emailString} (${dbDate} -> ${currentDate}) - resetting timers`);
                }
              // FIXED: For a new shift, always start as active
              // This ensures users start productive work at the beginning of each shift
              let preserveActive = true;
              
              // For new shifts, always force active state for productivity
              if (shiftInfo && shouldReset) {
                console.log(`New shift detected - forcing active state for productivity`);
                preserveActive = true;
              }
              
              console.log(`Shift reset: Activity state change for ${email}: ${userInfo.isActive} → ${preserveActive}`);
              
              // Reset user data
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
                   VALUES ($1, $4, 0, 0, $2, $3::date, NOW())
                   ON CONFLICT (user_id, today_date)
                   DO UPDATE SET
                     is_currently_active = EXCLUDED.is_currently_active,
                     today_active_seconds = 0,
                     today_inactive_seconds = 0,
                     last_session_start = EXCLUDED.last_session_start,
                     updated_at = NOW()`,
                  [userId, userInfo.sessionStart, currentDate, preserveActive]
                );
                console.log(`Created new activity record for ${email} on ${currentDate}`);
              }
            } else {
              // No activity data exists, create fresh record
                              console.log(`No activity data found during refresh for ${email} - creating fresh start`);
              
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
                  console.log(`User ${emailString} refreshing after shift start time (${shiftInfo.time}) - resetting timers`);
                }
              }
              
              if (shouldResetForRefresh) {
                // Reset timers for user refreshing after shift start
                userInfo.activeSeconds = 0;
                userInfo.inactiveSeconds = 0;
                // FIXED: Start as active after shift start, not inactive
                userInfo.isActive = true;
                userInfo.sessionStart = new Date().toISOString();
                // FIXED: Update lastShiftBoundaryTime when refresh reset occurs
                userInfo.lastShiftBoundaryTime = currentTime.toISOString();
                userInfo.lastResetAt = Date.now();
                userInfo.lastDbUpdate = 0; // Initialize for throttling
                userInfo.lastSocketEmit = 0; // Initialize for throttling
                userInfo.lastActivityEmit = 0; // Initialize for throttling
                console.log(`Refresh with reset for ${emailString} - ${refreshResetReason}`);
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
                console.log(`Refresh fresh start for ${emailString} - no reset needed`);
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
                       VALUES ($1, $2, $3, $4, $5, $6::date, NOW())`,
                       [userId, preserveActive, 0, 0, userInfo.sessionStart, currentDate]
                  );
                 } catch (insertError) {
                   // If insert fails due to conflict, it means a row already exists for this date
                   if (insertError.code === '23505') { // Unique constraint violation
                     console.log(`Activity record already exists for ${emailString} on ${currentDate} - updating instead`);
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
          console.error(`Database refresh failed for ${emailString}:`, dbError.message);
        }
        console.log(`Refresh completed for existing user: ${emailString}`);
      }

                     // Store user info - ensure email is stored as string
        // Get user's full name for chat functionality
        const userResult = await pool.query(
          'SELECT u.id, COALESCE(pi.first_name || \' \' || pi.last_name, u.email) as full_name FROM users u LEFT JOIN personal_info pi ON u.id = pi.user_id WHERE u.email = $1',
          [emailString]
        );
        const fullName = userResult.rows[0]?.full_name || emailString;
        
        const userSessionData = { 
          userId: userInfo.userId, 
          email: emailString, 
          userInfo,
          fullName 
        };
        
        connectedUsers.set(socket.id, userSessionData);
        
        // Store session in Redis for scalability
        await storeUserSession(socket.id, userSessionData);
        
        // Store socket connection in database
        const userAgent = socket.handshake.headers['user-agent'] || 'unknown';
        const ipAddress = socket.handshake.address || socket.conn.remoteAddress || 'unknown';
        const transport = socket.conn.transport.name || 'websocket';
        
        await storeSocketConnection(
          socket.id, 
          userInfo.userId, 
          emailString, 
          userAgent, 
          ipAddress, 
          transport
        );
        
        console.log(`AUTHENTICATION COMPLETED: Socket ${socket.id} now associated with user ${emailString}`);
        console.log(`Connected users map now contains:`, Array.from(connectedUsers.entries()).map(([id, data]) => `${id} -> ${data.email}`));
        // User authentication completed with data
        
        // Clean up any temporary user data that might exist
        for (const [socketId, userSessionData] of connectedUsers.entries()) {
          if (userSessionData.email.startsWith('temp_') && userSessionData.email === `temp_${socketId}`) {
            console.log(`🧹 Cleaning up temporary user data for socket ${socketId}`);
            connectedUsers.delete(socketId);
          }
        }
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
        } else {
          // Update existing status to online
          const status = userStatus.get(emailString);
          status.status = 'online';
          status.loginTime = new Date();
          status.lastSeen = new Date();
          console.log(`Updated userStatus to online for: ${emailString}`);
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
      console.log(`Getting meeting status for user: ${emailString}`);
      const isInMeeting = await getUserMeetingStatus(userInfo.userId);
      userMeetingStatus.set(emailString, isInMeeting);
      console.log(`Meeting status retrieved: ${isInMeeting}`);
      
      // IMPORTANT: Don't send initial data immediately - wait for database hydration
      let initialTimerData = {
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      };
      
      // Add shift reset information if available
      console.log(`Preparing timer data for: ${emailString}`);
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
        
        console.log(`Shift reset info for ${emailString}: ${formattedTimeUntilReset} until next reset`);
      }
      
      // Send initial meeting status
      console.log(`Sending meeting status for: ${emailString} - ${isInMeeting}`);
      try {
        socket.emit('meeting-status-update', { isInMeeting });
        console.log(`Meeting status sent for: ${emailString}`);
      } catch (emitError) {
        console.error(`Meeting status emit failed for: ${emailString}`, emitError.message);
      }
      
      // Join task activity rooms for real-time updates (by email and by userId)
      console.log(`Joining rooms for: ${emailString}`);
      try {
        socket.join(`task-activity-${emailString}`);
        if (userInfo.userId) {
          socket.join(`task-user-${userInfo.userId}`);
        }
        console.log(`Rooms joined for: ${emailString}`);
      } catch (roomError) {
        console.error(`Room joining failed for: ${emailString}`, roomError.message);
      }


      // FIXED: Simple hydration - use the existing data that was already loaded from the database
      try {
        console.log(`Using existing loaded data for ${emailString}: ${userInfo.activeSeconds}s active, ${userInfo.inactiveSeconds}s inactive, isActive: ${userInfo.isActive}`);
        
        // The data was already loaded in the earlier database query during user creation
        // Just ensure the initial timer data matches what was loaded
        initialTimerData.isActive = userInfo.isActive;
        initialTimerData.activeSeconds = userInfo.activeSeconds;
        initialTimerData.inactiveSeconds = userInfo.inactiveSeconds;
        initialTimerData.sessionStart = userInfo.sessionStart;
        
        console.log(`Timer data initialized for ${emailString}: ${userInfo.activeSeconds}s active, ${userInfo.inactiveSeconds}s inactive`);
        
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
        
        console.log(`Sending authenticated event for: ${emailString}`);
        try {
          socket.emit('authenticated', cleanTimerData);
          console.log(`Authenticated event sent for: ${emailString}`);
        } catch (authEmitError) {
          console.error(`Authenticated emit failed for: ${emailString}`, authEmitError.message);
        }
        
        // Also send a timer update to ensure client has latest data
        console.log(`Sending timerUpdated event for: ${emailString}`);
        try {
          socket.emit('timerUpdated', cleanTimerData);
          console.log(`TimerUpdated event sent for: ${emailString}`);
        } catch (timerEmitError) {
          console.error(`TimerUpdated emit failed for: ${emailString}`, timerEmitError.message);
        }
        
        const duration = Date.now() - startTime;
        console.log(`Authentication completed for ${emailString} in ${duration}ms`);
        
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
        console.log(`Authentication hydration failed for ${emailString}:`, error.message);
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
          console.error(`Fallback authenticated emit failed for: ${emailString}`, fallbackEmitError.message);
        }
        
        const duration = Date.now() - startTime;
        console.log(`Authentication completed (with errors) for ${emailString} in ${duration}ms`);
        
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
      
      // Note: Disconnect handling is done globally outside this authenticate handler
      // to avoid duplicate handlers and race conditions
        
      // Note: Error handling is done globally outside this authenticate handler
      // to avoid duplicate handlers and race conditions

      // Timer data is now sent via the authenticated event with proper hydration
    } catch (error) {
      const duration = Date.now() - startTime;
      const emailString = String(email || 'unknown');
      console.error(`Authentication error for ${emailString} after ${duration}ms:`, error.message);
      socket.emit('error', { message: 'Authentication failed: ' + error.message });
      
      // Clean up authentication tracking
      if (emailString !== 'unknown') {
        clearTimeout(authTimeout);
        authenticationInProgress.delete(emailString);
      }
    }
     });
   
   // Heartbeat handling for connection health monitoring
   socket.on('heartbeat', (data) => {
    const userData = connectedUsers.get(socket.id);
    if (userData) {
      userData.lastHeartbeat = Date.now();
      userData.lastHeartbeatAck = Date.now();
      // Send heartbeat acknowledgment
      socket.emit('heartbeat-ack', { timestamp: Date.now() });
    }
  });

  // Handle reconnection requests from clients
  socket.on('request-reconnection', async (data) => {
    try {
      const { email, userId } = data;
      
      if (!email || !userId) {
        socket.emit('reconnection-error', { message: 'Missing email or userId' });
        return;
      }

      console.log(`🔄 Reconnection request from ${email}`);
      
      // Check if user exists in our data or in disconnected users
      let userInfo = userData.get(email);
      if (!userInfo && disconnectedUsers.has(email)) {
        console.log(`🔄 Restoring user data from disconnected users for ${email}`);
        const disconnectedUserData = disconnectedUsers.get(email);
        userInfo = disconnectedUserData.userInfo;
        
        // Restore user data
        userData.set(email, userInfo);
        userShiftInfo.set(email, userInfo.shiftInfo);
        
        // Remove from disconnected users
        disconnectedUsers.delete(email);
        
        console.log(`✅ User ${email} data restored during reconnection`);
      }
      
      if (!userInfo) {
        socket.emit('reconnection-error', { message: 'User not found' });
        return;
      }

      // Update connection tracking
      connectedUsers.set(socket.id, {
        email: email,
        userId: userId,
        userInfo: userInfo,
        lastHeartbeat: Date.now(),
        lastHeartbeatAck: Date.now(),
        socketId: socket.id
      });

      // Update userConnections mapping
      if (!userConnections.has(email)) {
        userConnections.set(email, new Set());
      }
      userConnections.get(email).add(socket.id);

      // Send current user data to reconnected client
      const currentData = {
        userId: userInfo.userId,
        email: email,
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart,
        shiftInfo: userShiftInfo.get(email) || null,
        reconnection: true
      };

      socket.emit('reconnection-success', currentData);
      socket.emit('timerUpdated', currentData);
      
      // Update connection metrics
      connectionMetrics.reconnections++;
      connectionMetrics.activeConnections++;
      
      console.log(`✅ User ${email} reconnected successfully`);
      
    } catch (error) {
      console.error('Error handling reconnection request:', error);
      socket.emit('reconnection-error', { message: 'Reconnection failed' });
    }
  });

   // Global socket disconnect handler
   socket.on('disconnect', async (reason) => {
     try {
       // Update connection metrics
       connectionMetrics.disconnections++;
       connectionMetrics.activeConnections = Math.max(0, connectionMetrics.activeConnections - 1);
       
       // Clean up user connection tracking
       let userData = connectedUsers.get(socket.id);
       
       // If user data not found in memory, try to get it from database
       if (!userData) {
         console.log(`🔍 User data not found in memory for socket ${socket.id}, checking database...`);
         const dbUserData = await getUserBySocketId(socket.id);
         if (dbUserData) {
           userData = {
             email: dbUserData.user_email,
             userId: dbUserData.user_id,
             fullName: dbUserData.full_name
           };
           console.log(`✅ Found user data in database for socket ${socket.id}: ${dbUserData.user_email}`);
         }
       }
       
       console.log(`🔌 Socket ${socket.id} disconnecting (reason: ${reason}). Connected users before cleanup: ${connectedUsers.size}`);
       
       // Update socket connection status in database
       await disconnectSocket(socket.id, reason);
       
       // Update connection metrics
       updateConnectionMetrics(socket.id, 'disconnect', { reason });
       
       // Track ping timeouts specifically
       if (reason === 'ping timeout') {
         updateConnectionMetrics(socket.id, 'ping_timeout');
       }
       
       if (userData) {
         let { email, userId } = userData;
         
         // Ensure email is a string
         if (typeof email === 'object' && email.email) {
           email = email.email;
         }
         email = String(email);
         
         // Clean up user connections
         if (userConnections.has(email)) {
           userConnections.get(email).delete(socket.id);
           if (userConnections.get(email).size === 0) {
             userConnections.delete(email);
             
             // For ping timeouts, don't immediately mark as offline - give time for reconnection
             if (reason === 'ping timeout') {
               console.log(`🔄 Ping timeout for ${email} - preserving user data for potential reconnection`);
               
               // Store user data for potential reconnection
               disconnectedUsers.set(email, {
                 ...userData,
                 disconnectedAt: Date.now(),
                 reason: 'ping_timeout'
               });
               
               // Set a timeout to clean up user data if no reconnection occurs
               setTimeout(async () => {
                 // Check if user has reconnected
                 const hasReconnected = Array.from(connectedUsers.values()).some(user => user.email === email);
                 if (!hasReconnected) {
                   console.log(`🧹 Cleaning up user data for ${email} after ping timeout grace period`);
                   
                   // Remove from disconnected users
                   disconnectedUsers.delete(email);
                   
                   // Mark as offline after grace period
                   if (userStatus.has(email)) {
                     const status = userStatus.get(email);
                     status.status = 'offline';
                     status.lastSeen = new Date();
                     
                     // Broadcast the offline status
                     io.emit('user-status-update', {
                       id: userId || email,
                       email: email,
                       name: userData.fullName || email,
                       status: 'offline',
                       lastSeen: new Date().toISOString()
                     });
                     
                     console.log(`User ${email} marked as offline after ping timeout grace period`);
                   }
                 } else {
                   console.log(`User ${email} reconnected during grace period - keeping data`);
                   // Remove from disconnected users since they reconnected
                   disconnectedUsers.delete(email);
                 }
               }, 30000); // 30 second grace period for reconnection
             } else {
               // For non-ping timeout disconnections, mark as offline immediately
               if (userStatus.has(email)) {
                 const status = userStatus.get(email);
                 status.status = 'offline';
                 status.lastSeen = new Date();
                 
                 // Broadcast the offline status
                 io.emit('user-status-update', {
                   id: userId || email,
                   email: email,
                   name: userData.fullName || email,
                   status: 'offline',
                   lastSeen: new Date().toISOString()
                 });
                 
                 console.log(`User ${email} marked as offline - no more active connections`);
               }
             }
           } else {
             console.log(`User ${email} still has ${userConnections.get(email).size} active connections`);
           }
         }
         
         // Clean up connected users map
         connectedUsers.delete(socket.id);
         
         // Clean up Redis session
         await removeUserSession(socket.id);
         
         console.log(`🔌 Socket ${socket.id} disconnected for ${email}. Connected users after cleanup: ${connectedUsers.size}`);
         
         // Clean up any authentication in progress
         if (authenticationInProgress.has(email)) {
           authenticationInProgress.delete(email);
           console.log(`Cleaned up authentication in progress for ${email}`);
         }
         
       } else {
         console.log(`No user data found for disconnecting socket ${socket.id}`);
         
         // Try to clean up by searching through userConnections
         for (const [email, socketSet] of userConnections.entries()) {
           if (socketSet.has(socket.id)) {
             socketSet.delete(socket.id);
             console.log(`Cleaned up orphaned socket ${socket.id} from user ${email}`);
             
             if (socketSet.size === 0) {
               userConnections.delete(email);
               console.log(`Removed empty user connection set for ${email}`);
             }
             break;
           }
         }
       }
     } catch (error) {
       console.error(`Error during socket disconnect cleanup for ${socket.id}:`, error.message);
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
              
              // Only process if the score actually changed significantly (more than 0.01 points)
              const scoreChange = Math.abs(updateData.new_score - updateData.old_score);
              if (scoreChange < 0.01) {
                console.log(`Skipping productivity update for user ${updateData.user_id}: change too small (${scoreChange})`);
                return;
              }
              
              console.log(`Productivity score update notification received for user ${updateData.user_id}: ${updateData.old_score} -> ${updateData.new_score}`);
              
              // Emit real-time update to specific user only
              emitProductivityScoreUpdate(updateData.user_id, updateData.month_year);
            } catch (error) {
              console.error('Error handling productivity score update notification:', error);
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
            console.error(`Failed to LISTEN to ${channel}:`, err.message);
          });
        });
        
        global.__sa_task_activity_listener = true;
        
        // Handle client errors and cleanup
        client.on('error', (err) => {
          console.error('Global task activity listener error:', err.message);
          // Try to reconnect after a delay
          setTimeout(() => {
            try {
              client.release();
              global.__sa_task_activity_listener = false;
              console.log('Global task activity listener will reconnect on next request');
            } catch (_) {}
          }, 5000);
        });
        
        // Handle client end
        client.on('end', () => {
          console.log('🔌 Global task activity listener disconnected');
          global.__sa_task_activity_listener = false;
        });
        
      }).catch((err) => {
        console.error('Failed to connect global task activity listener:', err.message);
        global.__sa_task_activity_listener = false;
      });
    }
  } catch (err) {
    console.error('Error setting up global task activity listener:', err.message);
  }

  // Function to emit productivity score updates to connected users
  async function emitProductivityScoreUpdate(userId, monthYear) {
    try {
      // Check if pool is still available
      if (!isPoolAvailable()) {
        console.warn('Database pool is not available, skipping productivity score update');
        return;
      }
      
      // Throttle productivity updates: only allow one update per user per 30 seconds
      const lastUpdateKey = `productivity_update_${userId}`;
      const lastUpdate = global[lastUpdateKey] || 0;
      const timeSinceLastUpdate = Date.now() - lastUpdate;
      
      if (timeSinceLastUpdate < 30000) { // 30 seconds throttle
        console.log(`Throttling productivity update for user ${userId}: too soon (${timeSinceLastUpdate}ms ago)`);
        return;
      }
      
      // Update the last update timestamp
      global[lastUpdateKey] = Date.now();

      // Get the updated productivity score
      let scoreResult;
      try {
        // Double-check pool availability right before query
        if (!isPoolAvailable()) {
          console.warn('Database pool became unavailable before query, skipping productivity score update');
          return;
        }
        
        scoreResult = await pool.query(`
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
      } catch (poolError) {
        if (poolError.message.includes('Cannot use a pool after calling end')) {
          console.warn('Database pool was closed, skipping productivity score update');
          return;
        }
        throw poolError; // Re-throw other errors
      }
      
      if (scoreResult.rows.length > 0) {
        const score = scoreResult.rows[0];
        const email = score.email;
        
        // Invalidate Redis cache for productivity data
        try {
          // Invalidate productivity cache for this user
          const productivityCacheKey = `productivity:${email}:12`;
          await redisClient.del(productivityCacheKey);
          
          // Invalidate leaderboard cache for current month
          const leaderboardCacheKey = `leaderboard:100:${monthYear}`;
          await redisClient.del(leaderboardCacheKey);
          
          // Also invalidate any other leaderboard cache patterns
          await redisClient.del('leaderboard:*');
        } catch (cacheError) {
          console.error('Error invalidating cache:', cacheError.message);
        }
        
        // Emit to specific user only for real-time updates
        emitToUserSockets(score.user_id, email, 'productivityScoreUpdated', {
          email,
          userId: score.user_id,
          productivityScore: score.productivity_score,
          totalActiveTime: score.total_active_seconds,
          totalInactiveTime: score.total_inactive_seconds,
          timestamp: score.updated_at
        });
        
        // Only log significant productivity updates (every 0.1 points or more)
        const roundedScore = Math.round(score.productivity_score * 10) / 10;
        const lastLoggedScore = global[`last_logged_score_${userId}`] || 0;
        if (Math.abs(roundedScore - lastLoggedScore) >= 0.1) {
          console.log(`📊 Productivity update: ${email} → ${score.productivity_score} points`);
          global[`last_logged_score_${userId}`] = roundedScore;
        }
      }
    } catch (error) {
      console.error('Error emitting productivity score update:', error);
    }
  }

  // Make the function globally available for database triggers to call
  global.emitProductivityScoreUpdate = emitProductivityScoreUpdate;

  // Handle activity state changes
  socket.on('activityChange', async (data) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      // Handle both old format (boolean) and new format (object)
      const isActive = typeof data === 'boolean' ? data : data.isActive;
      const isSystemEvent = typeof data === 'object' ? data.isSystemEvent : false;

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
        
        // Throttle activity update emissions: only emit every 5 seconds to reduce client load
        // But allow immediate updates for system events (lock/unlock)
        const lastActivityEmit = userInfo.lastActivityEmit || 0;
        const timeSinceLastActivityEmit = Date.now() - lastActivityEmit;
        const shouldEmitActivity = isSystemEvent || timeSinceLastActivityEmit >= 5000; // Bypass throttle for system events
        
        if (shouldEmitActivity) {
          userSockets.forEach(socketId => {
            io.to(socketId).emit('activityUpdated', activityData);
          });
          
          // Update last activity emit timestamp
          userInfo.lastActivityEmit = Date.now();
          
          console.log(`Activity update sent to ${userSockets.size} connections for ${userData.email}`);
        }
      } else {
        console.log(`No connections found for ${userData.email} to send activity update`);
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
      const currentShiftId = shiftInfo ? getCurrentShiftId(new Date(), shiftInfo) : new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      const currentDate = currentShiftId; // Use shift ID as the date for database records

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
  // - Database updates: every 10 seconds (reduced from 5)
  // - Socket emissions: every 15 seconds (reduced from 10)
  // - Logging: only significant changes (60+ seconds)
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
      
      userInfo.activeSeconds = timerData.activeSeconds;
      userInfo.inactiveSeconds = timerData.inactiveSeconds;
      
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
              // Get current Manila time correctly using proper timezone conversion
              const now = new Date();
              const manilaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
              const curMinutes = manilaTime.getHours() * 60 + manilaTime.getMinutes();
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

          // Get current Manila time correctly
          const now = new Date();
          const philippinesNow = new Date(now.getTime() + (8 * 60 * 60 * 1000));
          const currentMinutesLocal = philippinesNow.getUTCHours() * 60 + philippinesNow.getUTCMinutes();

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
        
        // Throttle database updates: only update every 10 seconds to reduce load
        const lastDbUpdate = userInfo.lastDbUpdate || 0;
        const timeSinceLastUpdate = Date.now() - lastDbUpdate;
        const shouldUpdateDb = timeSinceLastUpdate >= 10000; // 10 seconds to reduce database load
        
        if (withinShift && shouldUpdateDb) {
          console.log(`Updating database for ${userData.email} - within shift window (date: ${currentDate})`);
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
          
          console.log(`Database updated successfully for ${userData.email}`);
        } else if (!withinShift) {
          console.log(`Skipping database update for ${userData.email} - outside shift window (date: ${currentDate})`);
          // Outside shift window: automatically set user to inactive if they were active
          if (userInfo.isActive) {
            console.log(`Shift ended - automatically setting ${userData.email} to inactive`);
            userInfo.isActive = false;
            // Update database to set inactive state
            try {
              await pool.query(
                `UPDATE activity_data 
                 SET is_currently_active = false, 
                     updated_at = NOW() 
                 WHERE user_id = $1 AND today_date = $2`,
                [userId, currentDate]
              );
              console.log(`Set ${userData.email} to inactive in database`);
            } catch (dbError) {
              console.error(`Failed to set ${userData.email} to inactive:`, dbError.message);
            }
          }
          // Outside shift window: do not increment or create rows
        } else if (!shouldUpdateDb) {
          // Silent skip for throttled updates - no logging to reduce spam
        }
        
        // Only log timer updates when database is updated or for significant changes (every 60 seconds)
        const shouldLogTimer = shouldUpdateDb || (userInfo.activeSeconds % 60 === 0) || (userInfo.inactiveSeconds % 60 === 0);
        if (shouldLogTimer) {
          console.log(`Updated timer for ${userData.email}: Active=${userInfo.activeSeconds}s, Inactive=${userInfo.inactiveSeconds}s`);
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
          const shouldEmitSocket = timeSinceLastEmit >= 15000; // 15 seconds
          
          if (shouldEmitSocket) {
            userSockets.forEach(socketId => {
              io.to(socketId).emit('timerUpdated', timerData);
            });
            
            // Update last socket emit timestamp
            userInfo.lastSocketEmit = Date.now();
            
          }
        } else {
          console.log(`No connections found for ${userData.email} to send timer update`);
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
      
      // Update detailed status
      updateUserDetailedStatus(userData.email, { isInMeeting });
      
      // Broadcast to all user connections
      broadcastMeetingStatus(userData.email, isInMeeting);
      
    } catch (error) {
      console.error('Meeting status update error:', error);
    }
  });

  // Handle break status updates
  socket.on('updateBreakStatus', async (isInBreak, breakId = null) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      console.log(`Break status updated for ${userData.email}: ${isInBreak ? 'On Break' : 'Not on Break'}`);
      
      // Update detailed status
      updateUserDetailedStatus(userData.email, { 
        isInBreak,
        activeBreakId: breakId
      });
      
    } catch (error) {
      console.error('Break status update error:', error);
    }
  });

  // Handle restroom status updates
  socket.on('updateRestroomStatus', async (isInRestroom) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      console.log(`Restroom status updated for ${userData.email}: ${isInRestroom ? 'In Restroom' : 'Not in Restroom'}`);
      
      // Update detailed status
      updateUserDetailedStatus(userData.email, { isInRestroom });
      
    } catch (error) {
      console.error('Restroom status update error:', error);
    }
  });

  // Handle event status updates
  socket.on('updateEventStatus', async (isInEvent, currentEvent = null) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      console.log(`Event status updated for ${userData.email}: ${isInEvent ? 'In Event' : 'Not in Event'}`);
      
      // Update detailed status
      updateUserDetailedStatus(userData.email, { 
        isInEvent,
        currentEvent
      });
      
    } catch (error) {
      console.error('Event status update error:', error);
    }
  });

  // Handle health status updates
  socket.on('updateHealthStatus', async (isGoingToClinic, isInClinic, currentHealthRequest = null) => {
    try {
      const userData = connectedUsers.get(socket.id);
      if (!userData) return;

      console.log(`Health status updated for ${userData.email}: Going to Clinic: ${isGoingToClinic}, In Clinic: ${isInClinic}`);
      
      // Update detailed status
      updateUserDetailedStatus(userData.email, { 
        isGoingToClinic,
        isInClinic,
        currentHealthRequest
      });
      
    } catch (error) {
      console.error('Health status update error:', error);
    }
  });





  // Note: Removed productivity-update handler to prevent infinite loops
  // Productivity updates are now handled via database triggers and emitProductivityScoreUpdate()

  // Handle requests for productivity data
  socket.on('requestProductivityData', async (data) => {
    try {
      const { email, userId } = data;
      console.log(`Productivity data requested for ${email} (ID: ${userId})`);
      
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
        
        console.log(`Productivity data sent to ${email}: ${score.productivity_score} points`);
      } else {
        console.log(` No productivity score found for ${email} (ID: ${userId})`);
      }
    } catch (error) {
      console.error('Error fetching productivity data:', error);
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
     console.log(`User logout event received for: ${emailString}`);
     
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
       
       console.log(`User ${emailString} logged out - status set to offline`);
     } else {
       console.log(`User ${emailString} not found in userStatus during logout`);
     }
   });

   // Handle user login event (for tracking login time)
   socket.on('user-login', async (email) => {
     const emailString = typeof email === 'string' ? email : String(email);
     console.log(`User login event received for: ${emailString}`);
     
     // Ensure userStatus entry exists for this user
     if (!userStatus.has(emailString)) {
       userStatus.set(emailString, {
         status: 'online',
         loginTime: new Date(),
         lastSeen: new Date()
       });
       console.log(`Created new userStatus entry for: ${emailString}`);
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
     
     console.log(`User ${emailString} logged in - status set to online`);
   });
});

const PORT = process.env.SOCKET_PORT || 3004;

// Add graceful shutdown handling for Railway
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  // Notify all clients about shutdown
  io.emit('server-shutdown', { message: 'Server is shutting down, please reconnect' });
  
  // Close all connections
  io.close(() => {
    console.log('✅ All socket connections closed');
    
    // Close database pool
    pool.end(() => {
      console.log('✅ Database pool closed');
      
      // Close Redis connection
      redisClient.quit().then(() => {
        console.log('✅ Redis connection closed');
        process.exit(0);
      }).catch(() => {
        console.log('✅ Redis connection closed (with error)');
        process.exit(0);
      });
    });
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.emit('SIGTERM');
});

// Add error handling for server startup
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Socket.IO server running on port ${PORT}`);
  console.log(`🌐 Server accessible at http://0.0.0.0:${PORT}`);
  console.log(`📊 Status endpoint: http://0.0.0.0:${PORT}/status`);
  console.log(`Break reminder scheduler: ${breakReminderScheduler.getStatus().isRunning ? 'Running' : 'Stopped'} (${breakReminderScheduler.getStatus().interval}s interval)`);
  console.log(`Task notification scheduler: ${taskNotificationScheduler.getStatus().isRunning ? 'Running' : 'Stopped'} (${taskNotificationScheduler.getStatus().interval}s interval)`);
  console.log(`Meeting scheduler: ${meetingScheduler.getStatus().isRunning ? 'Running' : 'Stopped'} (${meetingScheduler.getStatus().interval}s interval)`);
  console.log(`Event reminder scheduler: ${eventReminderScheduler.getStatus().isRunning ? 'Running' : 'Stopped'} (${eventReminderScheduler.getStatus().interval}s interval)`);
  console.log(`Announcement scheduler: ${announcementScheduler.getStatus().isRunning ? 'Running' : 'Stopped'} (${announcementScheduler.getStatus().interval}s interval)`);
  console.log(`All schedulers are now active and monitoring for notifications`);
  console.log(`✅ Server is ready and accepting connections!`);
});