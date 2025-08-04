require('dotenv').config({ path: '.env.local' });

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
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
  }
});

// In-memory storage for testing (since PostgreSQL is not running)
const connectedUsers = new Map();
const userData = new Map(); // Store user activity data in memory

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
        console.log(`Creating new user data for: ${email}`);
        userInfo = {
          userId: Date.now(), // Simple ID generation
          isActive: false,
          activeSeconds: 0,
          inactiveSeconds: 0,
          sessionStart: new Date().toISOString()
        };
        userData.set(email, userInfo);
      } else {
        console.log(`Found existing user data for: ${email}`, {
          activeSeconds: userInfo.activeSeconds,
          inactiveSeconds: userInfo.inactiveSeconds,
          isActive: userInfo.isActive
        });
        // Keep existing timer data - don't reset on reconnection
      }

      // Store user info
      connectedUsers.set(socket.id, { userId: userInfo.userId, email, userInfo });
      
      // Track user connections
      if (!userConnections.has(email)) {
        userConnections.set(email, new Set());
      }
      userConnections.get(email).add(socket.id);
      
      console.log(`User ${email} connected. Total connections: ${userConnections.get(email).size}`);
      
      // Send initial data immediately
      const timerData = {
        isActive: userInfo.isActive,
        activeSeconds: userInfo.activeSeconds,
        inactiveSeconds: userInfo.inactiveSeconds,
        sessionStart: userInfo.sessionStart
      };
      
      socket.emit('authenticated', timerData);
      
      // Join task activity room for real-time updates
      socket.join(`task-activity-${email}`);

      // Also send a timer update to ensure client has latest data
      socket.emit('timerUpdated', timerData);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('error', { message: 'Authentication failed: ' + error.message });
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

        // Update activity data in database with daily tracking (Philippines timezone)
        await pool.query(
          `INSERT INTO activity_data (user_id, is_currently_active, today_active_seconds, today_inactive_seconds, last_session_start, today_date, updated_at) 
           VALUES ($1, $2, $3, $4, $5, (NOW() AT TIME ZONE 'Asia/Manila')::date, NOW())
           ON CONFLICT (user_id, today_date) 
           DO UPDATE SET 
             is_currently_active = $2,
             today_active_seconds = $3,
             today_inactive_seconds = $4,
             last_session_start = COALESCE($5, activity_data.last_session_start),
             updated_at = NOW()`,
          [userId, userInfo.isActive, userInfo.activeSeconds, userInfo.inactiveSeconds, userInfo.sessionStart]
        );
        
        // Database updates silently - no logging needed
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