#!/usr/bin/env node

/**
 * Test script for power monitor functionality
 * This script simulates power monitor events to test the implementation
 */

const { app, powerMonitor } = require('electron');

console.log('🔋 Power Monitor Test Script');
console.log('============================');

// Test if power monitor is available
if (!powerMonitor) {
  console.error('❌ Power monitor is not available in this Electron version');
  process.exit(1);
}

console.log('✅ Power monitor is available');

// Test power monitor events
console.log('\n📋 Available power monitor events:');
console.log('- suspend: System going to sleep');
console.log('- resume: System resuming from sleep');
console.log('- lock-screen: System screen locked');
console.log('- unlock-screen: System screen unlocked');
console.log('- shutdown: System shutting down');

// Set up event listeners
powerMonitor.on('suspend', () => {
  console.log('💤 SUSPEND: System is going to sleep');
});

powerMonitor.on('resume', () => {
  console.log('🌅 RESUME: System resumed from sleep');
});

powerMonitor.on('lock-screen', () => {
  console.log('🔒 LOCK: System screen locked');
});

powerMonitor.on('unlock-screen', () => {
  console.log('🔓 UNLOCK: System screen unlocked');
});

powerMonitor.on('shutdown', () => {
  console.log('🔄 SHUTDOWN: System is shutting down');
});

console.log('\n✅ Power monitor event listeners registered');
console.log('\n📝 To test:');
console.log('1. Put your computer to sleep (Windows: Win+L then sleep, Mac: Apple menu > Sleep)');
console.log('2. Wake up your computer');
console.log('3. Lock your screen (Windows: Win+L, Mac: Ctrl+Cmd+Q)');
console.log('4. Unlock your screen');
console.log('\nThe events should be logged above when they occur.');

// Keep the script running
console.log('\n⏳ Waiting for power monitor events... (Press Ctrl+C to exit)');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Exiting power monitor test...');
  process.exit(0);
});

// Keep the process alive
setInterval(() => {
  // Just keep the process running
}, 1000);
