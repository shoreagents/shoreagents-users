const io = require('socket.io-client');

console.log('🧪 Testing Frontend Integration with Socket Server\n');

// Connect to the socket server
const socket = io('http://localhost:3001');

console.log('🔌 Connecting to socket server...');

socket.on('connect', () => {
  console.log('✅ Connected to socket server!');
  console.log('🆔 Socket ID:', socket.id);
  
  // Emit authentication (simulate frontend login)
  socket.emit('authenticate', {
    email: 'kyle.p@shoreagents.com',
    userId: 2
  });
  
  console.log('🔐 Authentication sent');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from socket server');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Listen for real-time activity updates
socket.on('activity-data-updated', (data) => {
  console.log('\n📡 Real-time activity update received!');
  console.log('📊 Update data:', JSON.stringify(data, null, 2));
  
  if (data.data) {
    console.log('🎯 Activity data:');
    console.log(`   • Active seconds: ${data.data.today_active_seconds}`);
    console.log(`   • Inactive seconds: ${data.data.today_inactive_seconds}`);
    console.log(`   • Is active: ${data.data.is_currently_active}`);
    console.log(`   • Date: ${data.data.today_date}`);
  }
  
  console.log('\n🎉 Frontend integration test successful!');
  console.log('✅ Real-time updates are working!');
  
  // Disconnect after successful test
  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 2000);
});

// Listen for other events
socket.on('notification', (data) => {
  console.log('📢 Notification received:', data);
});

// Timeout after 10 seconds if no activity update
setTimeout(() => {
  console.log('\n⏰ Timeout: No activity update received');
  console.log('💡 This might mean:');
  console.log('   1. Socket server is not listening for activity_data_change');
  console.log('   2. Database trigger is not working');
  console.log('   3. Frontend needs to trigger an activity update');
  
  socket.disconnect();
  process.exit(1);
}, 10000);

console.log('⏳ Waiting for real-time updates...');
console.log('💡 Run the test script in another terminal to trigger updates');
console.log('   node scripts/test-realtime-activity-system.js');
