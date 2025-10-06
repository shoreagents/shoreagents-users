#!/usr/bin/env node

/**
 * Test script for inactivity detection when screen is locked
 * This script simulates the activity tracker behavior to test screen lock handling
 */

const { app, powerMonitor, screen } = require('electron');

console.log('🔒 Screen Lock Inactivity Test Script');
console.log('=====================================');

// Simulate activity tracker behavior
class TestActivityTracker {
  constructor() {
    this.lastActivityTime = Date.now();
    this.inactivityThreshold = 10000; // 10 seconds for testing
    this.isTracking = false;
    this.isSystemSuspended = false;
    this.isScreenLocked = false;
    this.activityCheckInterval = null;
    
    this.setupPowerMonitoring();
  }

  setupPowerMonitoring() {
    try {
      // Listen for system suspend/resume events
      powerMonitor.on('suspend', () => {
        console.log('💤 System going to sleep - pausing inactivity detection');
        this.isSystemSuspended = true;
        this.pauseInactivityCheck();
      });

      powerMonitor.on('resume', () => {
        console.log('🌅 System resumed from sleep - resuming inactivity detection');
        this.isSystemSuspended = false;
        if (this.isTracking) {
          this.lastActivityTime = Date.now();
          this.startInactivityCheck();
        }
      });

      powerMonitor.on('lock-screen', () => {
        console.log('🔒 Screen locked - continuing inactivity detection');
        this.isScreenLocked = true;
        // Note: We don't pause inactivity detection for screen lock
      });

      powerMonitor.on('unlock-screen', () => {
        console.log('🔓 Screen unlocked - continuing inactivity detection');
        this.isScreenLocked = false;
        if (this.isTracking) {
          this.lastActivityTime = Date.now();
        }
      });
      
    } catch (error) {
      console.error('Error setting up power monitoring:', error);
    }
  }

  startTracking() {
    if (this.isTracking) {
      return;
    }
    
    console.log('✅ Starting activity tracking...');
    this.isTracking = true;
    this.lastActivityTime = Date.now();
    this.isSystemSuspended = false;
    this.isScreenLocked = false;
    
    this.startInactivityCheck();
  }

  startInactivityCheck() {
    if (this.activityCheckInterval) {
      return;
    }
    
    console.log('⏰ Starting inactivity check (10 second threshold)...');
    this.activityCheckInterval = setInterval(() => {
      this.checkInactivity();
    }, 1000);
  }

  pauseInactivityCheck() {
    if (this.activityCheckInterval) {
      clearInterval(this.activityCheckInterval);
      this.activityCheckInterval = null;
      console.log('⏸️ Paused inactivity check');
    }
  }

  checkInactivity() {
    if (!this.isTracking || this.isSystemSuspended) {
      return;
    }
    
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - this.lastActivityTime;
    
    console.log(`⏱️ Time since last activity: ${Math.floor(timeSinceLastActivity / 1000)}s (Screen locked: ${this.isScreenLocked})`);
    
    if (timeSinceLastActivity >= this.inactivityThreshold) {
      console.log('🚨 INACTIVITY DETECTED! (This should work even when screen is locked)');
      this.showInactivityAlert(timeSinceLastActivity);
    }
  }

  showInactivityAlert(timeSinceLastActivity) {
    const seconds = Math.floor(timeSinceLastActivity / 1000);
    console.log(`⚠️ Inactivity Alert: ${seconds}s inactive (Screen locked: ${this.isScreenLocked})`);
  }

  simulateActivity() {
    if (this.isSystemSuspended) {
      console.log('❌ Cannot simulate activity - system is suspended');
      return;
    }
    
    console.log('🖱️ Simulating user activity...');
    this.lastActivityTime = Date.now();
  }

  getStatus() {
    return {
      isTracking: this.isTracking,
      isSystemSuspended: this.isSystemSuspended,
      isScreenLocked: this.isScreenLocked,
      timeSinceLastActivity: Date.now() - this.lastActivityTime,
      inactivityThreshold: this.inactivityThreshold
    };
  }

  stopTracking() {
    console.log('🛑 Stopping activity tracking...');
    this.isTracking = false;
    this.pauseInactivityCheck();
  }
}

// Create test tracker
const tracker = new TestActivityTracker();

console.log('\n📋 Test Instructions:');
console.log('1. The script will start tracking activity with a 10-second threshold');
console.log('2. Lock your screen (Windows: Win+L, Mac: Ctrl+Cmd+Q)');
console.log('3. Wait 10+ seconds - you should see inactivity detection working');
console.log('4. Unlock your screen');
console.log('5. Put system to sleep - inactivity detection should pause');
console.log('6. Wake up system - inactivity detection should resume');
console.log('\nPress Ctrl+C to exit\n');

// Start tracking
tracker.startTracking();

// Show status every 5 seconds
const statusInterval = setInterval(() => {
  const status = tracker.getStatus();
  console.log(`📊 Status: Tracking=${status.isTracking}, Suspended=${status.isSystemSuspended}, Locked=${status.isScreenLocked}, Inactive=${Math.floor(status.timeSinceLastActivity / 1000)}s`);
}, 5000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping test...');
  tracker.stopTracking();
  clearInterval(statusInterval);
  process.exit(0);
});

// Keep the process alive
setInterval(() => {
  // Just keep the process running
}, 1000);
