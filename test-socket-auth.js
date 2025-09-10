const { io } = require('socket.io-client');

console.log('🔌 Testing socket authentication and event listening...');

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
  
  // Authenticate with the socket server
  console.log('🔐 Authenticating...');
  socket.emit('authenticate', { 
    email: 'agent@shoreagents.com',
    userId: 2 
  });
});

socket.on('authenticated', (data) => {
  console.log('✅ Authentication successful:', data);
});

socket.on('error', (error) => {
  console.log('❌ Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// Listen for event-related events
socket.on('event-change', (data) => {
  console.log('📡 Received event-change:', data);
});

socket.on('event-updated', (data) => {
  console.log('📡 Received event-updated:', data);
});

socket.on('event-attendance-change', (data) => {
  console.log('📡 Received event-attendance-change:', data);
});

// Keep the connection alive for testing
setTimeout(() => {
  console.log('⏰ Test completed. Closing connection...');
  socket.disconnect();
  process.exit(0);
}, 15000);
