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
    this.checkInterval = 60 * 1000; // Check every 60 seconds (1 minute)
  }

  async checkBreakReminders() {
    if (this.isRunning) {
      console.log('⏳ Break reminder check already running, skipping...');
      return;
    }

    this.isRunning = true;
    
    try {
      const startTime = Date.now();
      console.log(`🔍 [${new Date().toLocaleTimeString()}] Checking break reminders...`);
      
      // Call the database function to check all agents
      const result = await pool.query('SELECT check_break_reminders()');
      const notificationsSent = result.rows[0].check_break_reminders;
      
      const duration = Date.now() - startTime;
      
      if (notificationsSent > 0) {
        console.log(`📢 [${new Date().toLocaleTimeString()}] Sent ${notificationsSent} break reminder notifications (${duration}ms)`);
      } else {
        console.log(`✅ [${new Date().toLocaleTimeString()}] No break reminders needed (${duration}ms)`);
      }

      // After reminders, pre-create next-day activity rows where shifts have ended
      try {
        const precreate = await pool.query('SELECT precreate_next_day_activity_rows() AS created');
        const created = precreate.rows[0]?.created || 0;
        if (created > 0) {
          console.log(`🗓️  [${new Date().toLocaleTimeString()}] Pre-created ${created} next-day activity rows`);
        }
      } catch (e) {
        console.log(`⚠️  [${new Date().toLocaleTimeString()}] Precreate failed: ${e.message}`);
      }
      
    } catch (error) {
      console.error(`❌ [${new Date().toLocaleTimeString()}] Break reminder check failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      console.log('⚠️ Break reminder scheduler is already running');
      return;
    }

    console.log(`🚀 Starting break reminder scheduler (checking every ${this.checkInterval / 1000} seconds, aligned to top of minute)`);
    console.log('📋 Reminder types:');
    console.log('   • "Break available soon" - 15 minutes before break starts');
    console.log('   • "Break ending soon" - 5 minutes before break ends');
    console.log('   • Dynamic timing based on agent shift times from job_info table');
    
    // Run an immediate check (safe due to DB duplicate-prevention)
    this.checkBreakReminders();

    // Align to top of minute, then run every minute
    const now = Date.now();
    const delayToTopOfMinute = this.checkInterval - (now % this.checkInterval);
    setTimeout(() => {
      this.checkBreakReminders();
      this.intervalId = setInterval(() => {
        this.checkBreakReminders();
      }, this.checkInterval);
    }, delayToTopOfMinute);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Break reminder scheduler stopped');
    }
  }

  // Test function to manually trigger a check
  async testCheck() {
    console.log('🧪 Running manual break reminder test...');
    await this.checkBreakReminders();
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: !!this.intervalId,
      checkInterval: this.checkInterval,
      lastCheck: this.lastCheckTime || null
    };
  }
}

// Export for use in other modules
module.exports = BreakReminderScheduler;

// If run directly, start the scheduler
if (require.main === module) {
  const scheduler = new BreakReminderScheduler();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down break reminder scheduler...');
    scheduler.stop();
    pool.end().then(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down break reminder scheduler...');
    scheduler.stop();
    pool.end().then(() => {
      console.log('✅ Database connection closed');
      process.exit(0);
    });
  });

  // Start the scheduler
  scheduler.start();
}
