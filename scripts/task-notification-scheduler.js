const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

class TaskNotificationScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    // Task notifications can run less frequently than break reminders
    // Default: Check every 5 minutes (300 seconds)
    // For overdue tasks, this is sufficient as they don't need real-time updates
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes (300 seconds)
  }

  async checkTaskNotifications() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Call the database function to check all task notifications
      // This includes moving overdue tasks to Overdue column and sending notifications
      const result = await pool.query('SELECT check_all_task_notifications()');
      const notificationsSent = result.rows[0].check_all_task_notifications;
      
      if (notificationsSent > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Sent ${notificationsSent} task notifications`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] No task notifications needed`);
      }
      
      // Also check how many tasks were moved to overdue column
      const movedResult = await pool.query('SELECT move_overdue_tasks_to_overdue_column() as tasks_moved');
      const tasksMoved = movedResult.rows[0].tasks_moved;
      
      if (tasksMoved > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Moved ${tasksMoved} tasks to Overdue column`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Task notification check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`Starting task notification scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
    // Run an immediate check
    this.checkTaskNotifications();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkTaskNotifications();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Task notification scheduler stopped');
    }
  }

  // Method to change check interval dynamically
  setInterval(seconds) {
    const wasRunning = !!this.intervalId;
    
    if (wasRunning) {
      this.stop();
    }
    
    this.checkInterval = seconds * 1000;
    
    if (wasRunning) {
      this.start();
    }
    
    console.log(`Task notification interval changed to ${seconds} seconds`);
  }

  // Method to get current status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      interval: this.checkInterval / 1000,
      lastCheck: this.lastCheckTime
    };
  }

  // Method to manually trigger overdue task processing
  async processOverdueTasks() {
    try {
      console.log(`[${new Date().toLocaleTimeString()}] Manually processing overdue tasks...`);
      
      // Move overdue tasks to Overdue column
      const movedResult = await pool.query('SELECT move_overdue_tasks_to_overdue_column() as tasks_moved');
      const tasksMoved = movedResult.rows[0].tasks_moved;
      
      // Send overdue notifications
      const notificationsResult = await pool.query('SELECT check_overdue_task_notifications() as notifications_sent');
      const notificationsSent = notificationsResult.rows[0].notifications_sent;
      
      console.log(`[${new Date().toLocaleTimeString()}] Overdue processing complete: ${tasksMoved} tasks moved, ${notificationsSent} notifications sent`);
      
      return { tasksMoved, notificationsSent };
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error processing overdue tasks:`, error.message);
      throw error;
    }
  }

  // Method to get overdue task statistics
  async getOverdueStats() {
    try {
      const client = await pool.connect();
      
      try {
        // Count overdue tasks
        const overdueCountResult = await client.query(`
          SELECT COUNT(*) as count
          FROM tasks t
          JOIN task_groups tg ON t.group_id = tg.id
          WHERE tg.title = 'Overdue' AND t.status = 'active'
        `);
        
        // Count tasks that will become overdue soon (within 1 hour)
        const soonOverdueResult = await client.query(`
          SELECT COUNT(*) as count
          FROM tasks t
          WHERE t.due_date IS NOT NULL 
          AND t.status = 'active'
          AND t.due_date > now() AT TIME ZONE 'Asia/Manila'
          AND t.due_date <= (now() AT TIME ZONE 'Asia/Manila') + INTERVAL '1 hour'
        `);
        
        // Count recent overdue notifications
        const recentNotificationsResult = await client.query(`
          SELECT COUNT(*) as count
          FROM notifications n
          WHERE n.category = 'task' 
          AND n.title = 'Task overdue'
          AND n.created_at > (now() AT TIME ZONE 'Asia/Manila') - INTERVAL '24 hours'
        `);
        
        return {
          overdueTasks: overdueCountResult.rows[0].count,
          soonOverdue: soonOverdueResult.rows[0].count,
          recentNotifications: recentNotificationsResult.rows[0].count
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Error getting overdue stats:`, error.message);
      throw error;
    }
  }
}

// Export for use in other files
module.exports = TaskNotificationScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new TaskNotificationScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down task notification scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down task notification scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  scheduler.start();
  
  // Display initial overdue task stats
  setTimeout(async () => {
    try {
      const stats = await scheduler.getOverdueStats();
      console.log(`Initial overdue task stats:`);
      console.log(`Overdue tasks: ${stats.overdueTasks}`);
      console.log(`Soon overdue (within 1 hour): ${stats.soonOverdue}`);
      console.log(`Recent overdue notifications (24h): ${stats.recentNotifications}`);
    } catch (error) {
      console.log('Could not get initial overdue stats');
    }
  }, 2000); // Wait 2 seconds after starting
  
  console.log('Task notification scheduler is running. Press Ctrl+C to stop.');
  console.log('This scheduler now includes overdue task management:');
  console.log('Moves overdue tasks to Overdue column');
  console.log('Sends overdue notifications (prevents spamming)');
  console.log('Checks every 5 minutes');
}
