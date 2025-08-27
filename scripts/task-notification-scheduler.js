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
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes (300 seconds)
  }

  async checkTaskNotifications() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Call the database function to check all task notifications
      const result = await pool.query('SELECT check_all_task_notifications()');
      const notificationsSent = result.rows[0].check_all_task_notifications;
      
      if (notificationsSent > 0) {
        console.log(`📋 [${new Date().toLocaleTimeString()}] Sent ${notificationsSent} task notifications`);
      } else {
        console.log(`📋 [${new Date().toLocaleTimeString()}] No task notifications needed`);
      }
      
    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Task notification check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`🚀 Starting task notification scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
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
      console.log('🛑 Task notification scheduler stopped');
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
    
    console.log(`⚙️ Task notification interval changed to ${seconds} seconds`);
  }

  // Method to get current status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      interval: this.checkInterval / 1000,
      lastCheck: this.lastCheckTime
    };
  }
}

// Export for use in other files
module.exports = TaskNotificationScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new TaskNotificationScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down task notification scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down task notification scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  scheduler.start();
  
  console.log('📋 Task notification scheduler is running. Press Ctrl+C to stop.');
}
