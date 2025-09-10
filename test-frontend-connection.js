const { io } = require('socket.io-client');

console.log('🧪 Testing frontend socket connection...\n');

// Connect to socket server
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 5000,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  
  // Authenticate
  socket.emit('authenticate', { 
    email: 'agent@shoreagents.com',
    userId: 2 
  });
});

socket.on('authenticated', (data) => {
  console.log('✅ Socket authenticated:', data);
});

socket.on('connect_error', (error) => {
  console.log('❌ Socket connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Socket disconnected:', reason);
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

// Keep connection alive for testing
console.log('⏰ Socket connection test running...');
console.log('💡 This will help verify if the socket server is working');
console.log('💡 Check if you see connection and authentication messages above');
console.log('💡 Press Ctrl+C to stop');

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping test...');
  socket.disconnect();
  process.exit(0);
});
