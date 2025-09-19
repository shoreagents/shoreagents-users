const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

class AnnouncementScheduler {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.checkInterval = 2 * 1000; // Check every 2 seconds for precise timing
  }

  async processAnnouncements() {
    if (this.isRunning) {
      return; // Skip if already running
    }

    this.isRunning = true;
    
    try {
      // Process scheduled announcements
      const scheduledResult = await pool.query('SELECT process_scheduled_announcements()');
      const scheduledProcessed = scheduledResult.rows[0].process_scheduled_announcements;
      
      // Auto-dismiss expired announcements
      const expiredResult = await pool.query('SELECT auto_dismiss_expired_announcements()');
      const expiredProcessed = expiredResult.rows[0].auto_dismiss_expired_announcements;
      
      if (scheduledProcessed > 0 || expiredProcessed > 0) {
        console.log(`[${new Date().toLocaleTimeString()}] Processed ${scheduledProcessed} scheduled announcements, ${expiredProcessed} expired announcements`);
      }
      
    } catch (error) {
      console.error(`[${new Date().toLocaleTimeString()}] Announcement processing failed:`, error.message);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.intervalId) {
      return; // Already running
    }

    console.log(`Starting announcement scheduler (checking every ${this.checkInterval / 1000} seconds)`);
    
    // Run an immediate check
    this.processAnnouncements();

    // Set up interval
    this.intervalId = setInterval(() => {
      this.processAnnouncements();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Announcement scheduler stopped');
    }
  }

  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      interval: this.checkInterval / 1000,
      isProcessing: this.isRunning
    };
  }
}

module.exports = AnnouncementScheduler;