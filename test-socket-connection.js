const { io } = require('socket.io-client');

console.log('🔌 Testing socket connection...');

// Connect to the socket server
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 5000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Connected to socket server');
  console.log('   Socket ID:', socket.id);
  console.log('   Transport:', socket.io.engine.transport.name);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
  console.log('   This usually means the socket server is not running');
  console.log('   Please start the socket server with: node socket-server.js');
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

socket.on('event-change', (data) => {
  console.log('📡 Received event-change:', data);
});

socket.on('event-updated', (data) => {
  console.log('📡 Received event-updated:', data);
});

socket.on('event-attendance-change', (data) => {
  console.log('📡 Received event-attendance-change:', data);
});

// Test authentication
setTimeout(() => {
  if (socket.connected) {
    console.log('🔐 Testing authentication...');
    socket.emit('authenticate', { 
      email: 'agent@shoreagents.com',
      userId: 2 
    });
  }
}, 2000);

// Keep the connection alive for testing
setTimeout(() => {
  console.log('⏰ Test completed. Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 10000);
