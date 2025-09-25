const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

class BreakReminderScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 30 * 1000; // Check every 30 seconds for faster response
  }

  async checkBreakReminders() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Call the database function to check break reminders only
      // Note: This now only handles breaks, tasks are handled separately
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      
      if (notificationsSent > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Sent ${notificationsSent} break notifications`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Break reminder check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`Starting break reminder scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
    // Run an immediate check
    this.checkBreakReminders();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.checkBreakReminders();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Break reminder scheduler stopped');
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
module.exports = BreakReminderScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new BreakReminderScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down break reminder scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down break reminder scheduler...');
    scheduler.stop();
    process.exit(0);
  });

  // Start the scheduler
  scheduler.start();
  
  console.log('Break reminder scheduler is running. Press Ctrl+C to stop.');
}