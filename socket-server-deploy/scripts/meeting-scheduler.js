const { Pool } = require('pg');
const { createClient } = require('redis');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Redis client for cache invalidation
let redisClient = null;

const initializeRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.log('No REDIS_URL found, cache invalidation will be skipped');
    return null;
  }
  
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
      },
    });
    
    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
    
    await redisClient.connect();
    console.log('Redis connected for cache invalidation');
    return redisClient;
  } catch (error) {
    console.error('Redis initialization failed:', error);
    return null;
  }
};

class MeetingScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 500; // Check every 500ms (0.5 seconds) for meeting starts
    this.reminderInterval = 60 * 1000; // Check every 60 seconds for reminders
    this.reminderIntervalId = null;
    this.notificationIntervalId = null;
  }

  async checkScheduledMeetings() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Call the database function to check and start scheduled meetings
      const result = await pool.query('SELECT check_and_start_scheduled_meetings()');
      const meetingsStarted = result.rows[0].check_and_start_scheduled_meetings;
      
      if (meetingsStarted > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Started ${meetingsStarted} scheduled meetings`);
        
        // Invalidate Redis cache for all users to ensure frontend gets updated data
        try {
          await this.invalidateMeetingCache();
          console.log(`[${new Date().toLocaleTimeString()}] Invalidated meeting cache after starting ${meetingsStarted} meetings`);
        } catch (cacheError) {
          console.error(`[${new Date().toLocaleTimeString()}] Failed to invalidate cache:`, cacheError.message);
        }
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Meeting start check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  async checkMeetingReminders() {
    try {
      // Call the database function to check for meeting reminders
      const result = await pool.query('SELECT check_meeting_reminders()');
      const remindersSent = result.rows[0].check_meeting_reminders;
      
      if (remindersSent > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Sent ${remindersSent} meeting reminders`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Meeting reminder check failed:`, error.message);
    }
  }

  async checkMeetingNotifications() {
    try {
      // Call the database function to check and send meeting notifications
      const result = await pool.query('SELECT check_meeting_notifications()');
      const notificationResult = result.rows[0].check_meeting_notifications;
      
      if (notificationResult.total_sent > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Sent ${notificationResult.total_sent} meeting notifications (${notificationResult.reminders_sent} reminders, ${notificationResult.starts_sent} starts)`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Meeting notification check failed:`, error.message);
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`Starting meeting scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
    // Run immediate checks
    this.checkScheduledMeetings();
    this.checkMeetingReminders();
    this.checkMeetingNotifications();

    // Set up interval for meeting starts
    this.intervalId = setInterval(() => {
      this.checkScheduledMeetings();
    }, this.checkInterval);

    // Set up interval for meeting reminders
    this.reminderIntervalId = setInterval(() => {
      this.checkMeetingReminders();
    }, this.reminderInterval);

    // Set up interval for meeting notifications (check every 2 seconds to reduce load)
    this.notificationIntervalId = setInterval(() => {
      this.checkMeetingNotifications();
    }, 2000); // 2 seconds to reduce API load
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.reminderIntervalId) {
      clearInterval(this.reminderIntervalId);
      this.reminderIntervalId = null;
    }

    if (this.notificationIntervalId) {
      clearInterval(this.notificationIntervalId);
      this.notificationIntervalId = null;
    }
    
    // Close Redis connection
    if (redisClient) {
      redisClient.quit().catch(err => {
        console.error('Error closing Redis connection:', err);
      });
      redisClient = null;
    }
    
    console.log('Meeting scheduler stopped');
  }

  // Method to get current status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      checkInterval: this.checkInterval / 1000,
      reminderInterval: this.reminderInterval / 1000,
      notificationInterval: 2 // 2 seconds
    };
  }

  // Method to manually trigger meeting checks
  async processScheduledMeetings() {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Manually processing scheduled meetings...`);
      
      const result = await pool.query('SELECT check_and_start_scheduled_meetings()');
      const meetingsStarted = result.rows[0].check_and_start_scheduled_meetings;
      
      console.log(`[${new Date().toLocaleTimeString()}] Meeting processing complete: ${meetingsStarted} meetings started`);
      
      // Invalidate cache if meetings were started
      if (meetingsStarted > 0) {
        try {
          await this.invalidateMeetingCache();
          console.log(`[${new Date().toLocaleTimeString()}] Invalidated meeting cache after manual processing`);
        } catch (cacheError) {
          console.error(`[${new Date().toLocaleTimeString()}] Failed to invalidate cache:`, cacheError.message);
        }
      }
      
      return { meetingsStarted };
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error processing scheduled meetings:`, error.message);
      throw error;
    }
  }

  // Method to manually trigger notification checks
  async processMeetingNotifications() {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Manually processing meeting notifications...`);
      
      await this.checkMeetingNotifications();
      
      console.log(`[${new Date().toLocaleTimeString()}] Meeting notification processing completed`);
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error processing meeting notifications:`, error.message);
      throw error;
    }
  }

  // Method to invalidate meeting cache
  async invalidateMeetingCache() {
    try {
      if (!redisClient) {
        console.log(`[${new Date().toLocaleTimeString()}] Initializing Redis connection for cache invalidation...`);
        redisClient = await initializeRedis();
        if (!redisClient) {
          console.log(`[${new Date().toLocaleTimeString()}] Redis not available, skipping cache invalidation`);
          return;
        }
      }
      
      // Get all user IDs from the database
      const usersResult = await pool.query('SELECT DISTINCT agent_user_id FROM meetings WHERE agent_user_id IS NOT NULL');
      const userIds = usersResult.rows.map(row => row.agent_user_id);
      
      console.log(`[${new Date().toLocaleTimeString()}] Starting cache invalidation for ${userIds.length} users...`);
      
      // Invalidate cache for each user
      let totalKeysCleared = 0;
      for (const userId of userIds) {
        // Invalidate meetings cache patterns
        const patterns = [
          `meetings:${userId}:7:*`,
          `meeting-status:${userId}:7`,
          `meeting-counts:${userId}:7`
        ];
        
        for (const pattern of patterns) {
          try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
              await redisClient.del(keys);
              totalKeysCleared += keys.length;
              console.log(`[${new Date().toLocaleTimeString()}] Cleared ${keys.length} keys for pattern: ${pattern}`);
            }
          } catch (patternError) {
            console.error(`[${new Date().toLocaleTimeString()}] Error invalidating pattern ${pattern}:`, patternError.message);
          }
        }
      }
      
      // Also clear any general meeting cache patterns
      const generalPatterns = [
        'meetings:*',
        'meeting-status:*',
        'meeting-counts:*'
      ];
      
      for (const pattern of generalPatterns) {
        try {
          const keys = await redisClient.keys(pattern);
          if (keys.length > 0) {
            await redisClient.del(keys);
            totalKeysCleared += keys.length;
            console.log(`[${new Date().toLocaleTimeString()}] Cleared ${keys.length} keys for general pattern: ${pattern}`);
          }
        } catch (patternError) {
          console.error(`[${new Date().toLocaleTimeString()}] Error invalidating general pattern ${pattern}:`, patternError.message);
        }
      }
      
      console.log(`[${new Date().toLocaleTimeString()}] Cache invalidation complete: ${totalKeysCleared} keys cleared for ${userIds.length} users`);
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error invalidating cache:`, error.message);
      console.error(`[${new Date().toLocaleTimeString()}] Full error:`, error);
      // Don't throw error to prevent scheduler from stopping
    }
  }

  // Method to get meeting statistics
  async getMeetingStats() {
    try {
      const client = await pool.connect();
      
      try {
        // Count scheduled meetings
        const scheduledCountResult = await client.query(`
          SELECT COUNT(*) as count
          FROM meetings
          WHERE status = 'scheduled'
        `);
        
        // Count in-progress meetings
        const inProgressCountResult = await client.query(`
          SELECT COUNT(*) as count
          FROM meetings
          WHERE status = 'in-progress'
        `);
        
        // Count meetings starting within the next hour
        const soonStartingResult = await client.query(`
          SELECT COUNT(*) as count
          FROM meetings
          WHERE status = 'scheduled'
          AND start_time BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
        `);
        
        return {
          scheduledMeetings: scheduledCountResult.rows[0].count,
          inProgressMeetings: inProgressCountResult.rows[0].count,
          soonStarting: soonStartingResult.rows[0].count
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error getting meeting stats:`, error.message);
      throw error;
    }
  }
}

// Export for use in other files
module.exports = MeetingScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new MeetingScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down meeting scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down meeting scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  scheduler.start();
  
  // Display initial meeting stats
  setTimeout(async () => {
    try {
      const stats = await scheduler.getMeetingStats();
      console.log(`Initial meeting stats:`);
      console.log(`Scheduled meetings: ${stats.scheduledMeetings}`);
      console.log(`In-progress meetings: ${stats.inProgressMeetings}`);
      console.log(`Starting within 1 hour: ${stats.soonStarting}`);
    } catch (error) {
      console.log('Could not get initial meeting stats');
    }
  }, 2000); // Wait 2 seconds after starting
  
  console.log('Meeting scheduler is running. Press Ctrl+C to stop.');
  console.log('This scheduler handles:');
  console.log('Automatically starting scheduled meetings');
  console.log('Sending meeting reminders (1 hour before)');
  console.log('Checking every 0.5 seconds for starts, 60 seconds for reminders, 2 seconds for notifications');
}