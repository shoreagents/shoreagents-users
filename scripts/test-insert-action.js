const io = require('socket.io-client');

console.log('🧪 Testing INSERT Action Handling in Frontend\n');

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
  console.log('⏳ Waiting for INSERT action notification...');
  console.log('💡 Run this in another terminal to create a new row:');
  console.log('   node scripts/test-new-row-creation.js');
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
  
  if (data.action === 'INSERT') {
    console.log('\n🆕 INSERT ACTION DETECTED!');
    console.log('🎯 This should trigger automatic data refresh in the frontend');
    console.log('📅 New date:', data.data.today_date);
    console.log('⏱️ New timer values:', data.data.today_active_seconds, 's active,', data.data.today_inactive_seconds, 's inactive');
    
    console.log('\n🎉 INSERT action test successful!');
    console.log('✅ Frontend should automatically fetch new data');
    console.log('✅ No page reload needed');
    
    // Disconnect after successful test
    setTimeout(() => {
      socket.disconnect();
      process.exit(0);
    }, 3000);
  } else if (data.action === 'UPDATE') {
    console.log('\n📝 UPDATE ACTION DETECTED');
    console.log('🔄 This updates existing data in real-time');
  }
  
  console.log('\n📋 Action type:', data.action);
  console.log('📅 Date:', data.data.today_date);
  console.log('⏱️ Active:', data.data.today_active_seconds, 's');
  console.log('⏱️ Inactive:', data.data.today_inactive_seconds, 's');
});

// Listen for other events
socket.on('notification', (data) => {
  console.log('📢 Notification received:', data);
});

// Timeout after 30 seconds if no INSERT action
setTimeout(() => {
  console.log('\n⏰ Timeout: No INSERT action received');
  console.log('💡 This might mean:');
  console.log('   1. No new rows were created');
  console.log('   2. INSERT notifications are not working');
  console.log('   3. Need to run the row creation test');
  
  socket.disconnect();
  process.exit(1);
}, 30000);

console.log('⏳ Waiting for INSERT action...');
console.log('💡 Create a new row in another terminal to test INSERT handling');
