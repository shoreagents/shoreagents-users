
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

class EventReminderScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 10 * 1000; // Check every 10 seconds for faster response
  }

  async checkEventReminders() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Call the database function to check event reminders
      const result = await pool.query('SELECT send_event_reminders()');
      const notificationsSent = result.rows[0].send_event_reminders;
      
      if (notificationsSent > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Sent ${notificationsSent} event notifications`);
      }
      
      // Update all event statuses using the comprehensive function
      const statusUpdateResult = await pool.query('SELECT * FROM update_all_event_statuses()');
      const statusUpdate = statusUpdateResult.rows[0];
      
      if (statusUpdate.updated_count > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Event status updates: ${statusUpdate.details}`);
      }
      
      // Check for events that are already 'today' and should have started (create notifications)
      const startedEventsResult = await pool.query(`
        SELECT id, title, event_type, start_time, end_time, location
        FROM events 
        WHERE status = 'today' 
        AND event_date = (NOW() AT TIME ZONE 'Asia/Manila')::date 
        AND start_time::TIME <= (NOW() AT TIME ZONE 'Asia/Manila')::TIME
      `);
      
      if (startedEventsResult.rows.length > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Checking ${startedEventsResult.rows.length} events that should have started:`, 
          startedEventsResult.rows.map(r => `${r.title} (${r.event_type || 'event'})`));
        
        // Create "Event Started" notifications for each event that should have started
        for (const event of startedEventsResult.rows) {
          // Check if we already sent "Event Started" notifications for this event today
          const existingNotifications = await pool.query(`
            SELECT COUNT(*) as count
            FROM notifications 
            WHERE payload->>'event_id' = '${event.id}'
            AND payload->>'notification_type' = 'event_started'
            AND payload->>'event_date' = (NOW() AT TIME ZONE 'Asia/Manila')::date::text
          `);
          
          if (existingNotifications.rows[0].count === '0') {
            // Create "Event Started" notifications for all users
            const eventStartedResult = await pool.query(`
              INSERT INTO notifications (user_id, category, type, title, message, payload)
              SELECT 
                u.id,
                'event',
                'info',
                format('%s Started - Please Join', 
                       CASE 
                           WHEN COALESCE('${event.event_type}', 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END),
                format('%s "%s" has started at %s (%s)', 
                       CASE 
                           WHEN COALESCE('${event.event_type}', 'event') = 'activity' THEN 'Activity'
                           ELSE 'Event'
                       END,
                       '${event.title}', 
                       to_char('${event.start_time}'::TIME, 'HH12:MI AM'),
                       '${event.location}'),
              jsonb_build_object(
                'event_id', ${event.id},
                'event_title', '${event.title}',
                'event_date', (NOW() AT TIME ZONE 'Asia/Manila')::date,
                'start_time', '${event.start_time}',
                'end_time', '${event.end_time}',
                'location', '${event.location}',
                'status', 'today',
                'event_type', COALESCE('${event.event_type}', 'event'),
                'notification_type', 'event_started',
                'action_url', '/status/events?tab=today&eventId=' || ${event.id}
              )
              FROM users u
              RETURNING id, user_id, title
            `);
            
            console.log(`[${new Date().toLocaleTimeString()}] Created ${eventStartedResult.rows.length} "Event Started" notifications for "${event.title}"`);
          } else {
            console.log(`[${new Date().toLocaleTimeString()}] "Event Started" notifications already sent for "${event.title}"`);
          }
        }
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Event reminder check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`Starting event reminder scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
    // Run an immediate check
    this.checkEventReminders();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkEventReminders();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Event reminder scheduler stopped');
    }
  }

  // Method to get current status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      interval: this.checkInterval / 1000
    };
  }
}

// Export for use in other files
module.exports = EventReminderScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new EventReminderScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down event reminder scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down event reminder scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  scheduler.start();
  
  console.log('Event reminder scheduler is running. Press Ctrl+C to stop.');
}