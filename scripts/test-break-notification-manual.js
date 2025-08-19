#!/usr/bin/env node

/**
 * Manual Break Notification Test
 * 
 * This script connects to the socket server and manually triggers
 * break notification checks to see if they're working.
 */

const io = require('socket.io-client');

async function testBreakNotifications() {
  console.log('🔌 Connecting to socket server...');
  
  // Connect to the socket server
  const socket = io('http://localhost:3001');
  
  socket.on('connect', () => {
    console.log('✅ Connected to socket server');
    
    // Authenticate with the user
    socket.emit('authenticate', {
      email: 'kyle.p@shoreagents.com',
      userId: 2
    });
  });
  
  socket.on('authenticated', (data) => {
    console.log('✅ Authenticated successfully');
    console.log('User data:', data);
    
    // Request break notifications
    console.log('🔔 Requesting break notifications...');
    socket.emit('request-break-notifications');
  });
  
  socket.on('break-status-update', (data) => {
    console.log('📢 Received break status update:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('db-notification', (data) => {
    console.log('🔔 Received database notification:');
    console.log(JSON.stringify(data, null, 2));
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Disconnected from socket server');
  });
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
  
  // Wait a bit then manually check break status
  setTimeout(() => {
    console.log('🔍 Manually checking break status...');
    socket.emit('check-break-status');
  }, 2000);
  
  // Keep the connection alive for a while
  setTimeout(() => {
    console.log('🔌 Closing connection...');
    socket.disconnect();
    process.exit(0);
  }, 10000);
}

// Run the test
if (require.main === module) {
  testBreakNotifications().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { testBreakNotifications };
