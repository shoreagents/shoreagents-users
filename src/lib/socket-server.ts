import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Pool } from 'pg';

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

let pool: Pool | null = null;

const getPool = () => {
  if (!pool) {
    pool = new Pool(databaseConfig);
  }
  return pool;
};

interface TimerData {
  userId: number;
  email: string;
  isActive: boolean;
  activeSeconds: number;
  inactiveSeconds: number;
  sessionStart: string | null;
}

interface ClientSession {
  userId: number;
  email: string;
  isActive: boolean;
  lastUpdate: Date;
  sessionStart: Date | null;
}

const clientSessions = new Map<string, ClientSession>();

export function initializeSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3005",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle user authentication
    socket.on('authenticate', async (data: { userId?: number; email: string }) => {
      try {
        const pool = getPool();
        let userId = data.userId;
        
        if (!userId && data.email) {
          const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [data.email]);
          if (userResult.rows.length === 0) {
            socket.emit('error', { message: 'User not found' });
            return;
          }
          userId = userResult.rows[0].id;
        }

        if (!userId) {
          socket.emit('error', { message: 'Invalid user data' });
          return;
        }

        // Get or create activity data
        const activityResult = await pool.query(
          'SELECT * FROM activity_data WHERE user_id = $1',
          [userId]
        );

        let activityData;
        if (activityResult.rows.length === 0) {
          // Create new activity record - start as active for new users
          const insertResult = await pool.query(
            'INSERT INTO activity_data (user_id, is_currently_active) VALUES ($1, true) RETURNING *',
            [userId]
          );
          activityData = insertResult.rows[0];
        } else {
          activityData = activityResult.rows[0];
        }

        // Store client session
        clientSessions.set(socket.id, {
          userId,
          email: data.email,
          isActive: activityData.is_currently_active,
          lastUpdate: new Date(),
          sessionStart: activityData.last_session_start ? new Date(activityData.last_session_start) : null
        });

        // Send initial data to client
        socket.emit('timer_initialized', {
          isActive: activityData.is_currently_active,
          activeSeconds: activityData.today_active_seconds || 0,
          inactiveSeconds: activityData.today_inactive_seconds || 0,
          sessionStart: activityData.last_session_start
        });

      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('error', { message: 'Authentication failed' });
      }
    });

    // Handle activity state changes
    socket.on('activity_change', async (data: { isActive: boolean }) => {
      try {
        const session = clientSessions.get(socket.id);
        if (!session) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const pool = getPool();
        const now = new Date();
        const wasActive = session.isActive;
        const isActive = data.isActive;

        // Only process if state actually changed
        if (wasActive !== isActive) {
          // Calculate time since last update
          const secondsDiff = Math.floor((now.getTime() - session.lastUpdate.getTime()) / 1000);
          
          // Get current values from database
          const currentResult = await pool.query(
            'SELECT today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = $1',
            [session.userId]
          );

          if (currentResult.rows.length === 0) {
            socket.emit('error', { message: 'Activity data not found' });
            return;
          }

          const current = currentResult.rows[0];
          let newActiveSeconds = current.today_active_seconds || 0;
          let newInactiveSeconds = current.today_inactive_seconds || 0;
          let sessionStart = session.sessionStart;

          if (wasActive) {
            // Was active, now inactive - add to active time
            newActiveSeconds += secondsDiff;
          } else {
            // Was inactive, now active - add to inactive time and start new session
            newInactiveSeconds += secondsDiff;
            sessionStart = now;
          }

          // Update database
          await pool.query(
            `UPDATE activity_data 
             SET is_currently_active = $1, 
                 today_active_seconds = $2, 
                 today_inactive_seconds = $3, 
                 last_session_start = $4, 
                 updated_at = NOW() 
             WHERE user_id = $5`,
            [isActive, newActiveSeconds, newInactiveSeconds, sessionStart, session.userId]
          );

          // Update session
          session.isActive = isActive;
          session.lastUpdate = now;
          session.sessionStart = sessionStart;

          // Notify all clients about the change
          io.emit('timer_updated', {
            userId: session.userId,
            isActive,
            activeSeconds: newActiveSeconds,
            inactiveSeconds: newInactiveSeconds,
            sessionStart
          });
        }
      } catch (error) {
        console.error('Activity change error:', error);
        socket.emit('error', { message: 'Failed to update activity' });
      }
    });

    // Handle periodic timer updates (every 5 seconds)
    socket.on('timer_tick', async () => {
      try {
        const session = clientSessions.get(socket.id);
        if (!session) return;

        const pool = getPool();
        const now = new Date();
        const secondsDiff = Math.floor((now.getTime() - session.lastUpdate.getTime()) / 1000);

        if (secondsDiff >= 5) { // Only update every 5 seconds
          // Get current values from database
          const currentResult = await pool.query(
            'SELECT today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = $1',
            [session.userId]
          );

          if (currentResult.rows.length > 0) {
            const current = currentResult.rows[0];
            let newActiveSeconds = current.today_active_seconds || 0;
            let newInactiveSeconds = current.today_inactive_seconds || 0;

            if (session.isActive) {
              newActiveSeconds += secondsDiff;
            } else {
              newInactiveSeconds += secondsDiff;
            }

            // Update database
            await pool.query(
              `UPDATE activity_data 
               SET today_active_seconds = $1, 
                   today_inactive_seconds = $2, 
                   updated_at = NOW() 
               WHERE user_id = $3`,
              [newActiveSeconds, newInactiveSeconds, session.userId]
            );

            // Update session
            session.lastUpdate = now;

            // Notify all clients about the update
            io.emit('timer_updated', {
              userId: session.userId,
              isActive: session.isActive,
              activeSeconds: newActiveSeconds,
              inactiveSeconds: newInactiveSeconds,
              sessionStart: session.sessionStart
            });
          }
        }
      } catch (error) {
        console.error('Timer tick error:', error);
      }
    });

    // Handle logout events
    socket.on('logout', async () => {
      try {
        const session = clientSessions.get(socket.id);
        if (session) {
          const pool = getPool();
          
          // Set is_currently_active to false on logout
          await pool.query(
            `UPDATE activity_data 
             SET is_currently_active = false, 
                 updated_at = NOW() 
             WHERE user_id = $1 
             AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
            [session.userId]
          );

          console.log(`User ${session.userId} logged out - activity status set to inactive`);
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    });

    // Handle user logout events (with email)
    socket.on('user-logout', async (data: { email: string }) => {
      try {
        const pool = getPool();
        
        // Find user by email and set is_currently_active to false
        const userResult = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [data.email]
        );

        if (userResult.rows.length > 0) {
          const userId = userResult.rows[0].id;
          
          await pool.query(
            `UPDATE activity_data 
             SET is_currently_active = false, 
                 updated_at = NOW() 
             WHERE user_id = $1 
             AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
            [userId]
          );

          console.log(`User ${data.email} (ID: ${userId}) logged out - activity status set to inactive`);
        }
      } catch (error) {
        console.error('User logout error:', error);
      }
    });

    // Handle break expiration check requests
    socket.on('check-break-expiration', async (data: { userId: number }) => {
      try {
        const pool = getPool();
        
        // Mark expired breaks for this user
        const result = await pool.query('SELECT mark_expired_breaks() as count');
        const expiredCount = result.rows[0].count;
        
        // Always get current break sessions for this user (regardless of new expirations)
        const sessionsResult = await pool.query(`
          SELECT bs.id, bs.break_type, bs.start_time, bs.end_time, bs.status,
                 is_break_session_expired(bs.id) as is_expired
          FROM break_sessions bs
          WHERE bs.agent_user_id = $1
          AND bs.break_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
          ORDER BY bs.start_time DESC
        `, [data.userId]);
        
        // Always emit break expiration update to keep frontend in sync
        socket.emit('break-expiration-updated', {
          expiredCount,
          sessions: sessionsResult.rows
        });
      } catch (error) {
        console.error('Break expiration check error:', error);
        socket.emit('break-expiration-error', { message: 'Failed to check break expiration' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
      try {
        const session = clientSessions.get(socket.id);
        if (session) {
          // Final update before disconnecting
          const pool = getPool();
          const now = new Date();
          const secondsDiff = Math.floor((now.getTime() - session.lastUpdate.getTime()) / 1000);

          if (secondsDiff > 0) {
            const currentResult = await pool.query(
              'SELECT today_active_seconds, today_inactive_seconds FROM activity_data WHERE user_id = $1',
              [session.userId]
            );

            if (currentResult.rows.length > 0) {
              const current = currentResult.rows[0];
              let newActiveSeconds = current.today_active_seconds || 0;
              let newInactiveSeconds = current.today_inactive_seconds || 0;

              if (session.isActive) {
                newActiveSeconds += secondsDiff;
              } else {
                newInactiveSeconds += secondsDiff;
              }

              await pool.query(
                `UPDATE activity_data 
                 SET today_active_seconds = $1, 
                     today_inactive_seconds = $2, 
                     updated_at = NOW() 
                 WHERE user_id = $3`,
                [newActiveSeconds, newInactiveSeconds, session.userId]
              );
            }
          }

          // Set is_currently_active to false on disconnect
          await pool.query(
            `UPDATE activity_data 
             SET is_currently_active = false, 
                 updated_at = NOW() 
             WHERE user_id = $1 
             AND today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date`,
            [session.userId]
          );

          clientSessions.delete(socket.id);
          console.log(`User ${session.userId} disconnected from socket ${socket.id} - activity status set to inactive`);
        }
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });

  return io;
} 