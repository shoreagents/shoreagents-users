const { Pool } = require('pg');
const { io } = require('socket.io-client');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testRealtimeNotifications() {
  try {
    console.log('🧪 Testing Real-Time Notification System\n');
    
    // 1. Test database connection and LISTEN
    console.log('1️⃣ Testing database LISTEN/NOTIFY...');
    const client = await pool.connect();
    
    // Set up a listener for notifications
    await client.query('LISTEN notifications');
    console.log('   ✅ Listening to notifications channel');
    
    let notificationReceived = false;
    const notificationPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false); // Timeout
      }, 5000); // 5 second timeout
      
      client.on('notification', (msg) => {
        if (msg.channel === 'notifications') {
          console.log('   📡 Database notification received:', msg.payload);
          notificationReceived = true;
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
    
    // 2. Test Socket.IO connection
    console.log('\n2️⃣ Testing Socket.IO connection...');
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
    console.log(`   Connecting to: ${socketServerUrl}`);
    
    const socket = io(socketServerUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
    });
    
    const socketPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false); // Timeout
      }, 5000); // 5 second timeout
      
      socket.on('connect', () => {
        console.log('   ✅ Socket.IO connected successfully');
        
        // Authenticate with test email
        socket.emit('authenticate', 'kyle.p@shoreagents.com');
        console.log('   🔐 Authentication sent');
      });
      
      socket.on('authenticated', (data) => {
        console.log('   ✅ Socket authenticated:', data);
      });
      
      socket.on('db-notification', (notification) => {
        console.log('   📡 Socket notification received:', notification);
        resolve(true);
      });
      
      socket.on('connect_error', (error) => {
        console.log('   ❌ Socket connection error:', error.message);
        resolve(false);
      });
      
      socket.on('disconnect', (reason) => {
        console.log('   🔌 Socket disconnected:', reason);
      });
    });
    
    // 3. Create a test notification
    console.log('\n3️⃣ Creating test notification...');
    const testResult = await pool.query(`
      INSERT INTO notifications (user_id, category, type, title, message, payload) 
      VALUES (2, 'break', 'warning', 'Real-Time Test', 'Testing real-time notification delivery', '{"test": "realtime"}')
      RETURNING id
    `);
    const notificationId = testResult.rows[0].id;
    console.log(`   ✅ Test notification created with ID: ${notificationId}`);
    
    // 4. Wait for results
    console.log('\n4️⃣ Waiting for real-time delivery...');
    
    const [dbNotificationReceived, socketNotificationReceived] = await Promise.all([
      notificationPromise,
      socketPromise
    ]);
    
    // 5. Results
    console.log('\n📊 Test Results:');
    console.log(`   Database LISTEN/NOTIFY: ${dbNotificationReceived ? '✅ Working' : '❌ Failed'}`);
    console.log(`   Socket.IO delivery: ${socketNotificationReceived ? '✅ Working' : '❌ Failed'}`);
    
    if (dbNotificationReceived && socketNotificationReceived) {
      console.log('\n🎉 Real-time notification system is working perfectly!');
    } else if (dbNotificationReceived && !socketNotificationReceived) {
      console.log('\n⚠️ Database notifications working, but Socket.IO delivery failed');
      console.log('   This suggests a frontend connection issue');
    } else if (!dbNotificationReceived && socketNotificationReceived) {
      console.log('\n⚠️ Socket.IO working, but database notifications not being sent');
      console.log('   This suggests a database trigger issue');
    } else {
      console.log('\n❌ Both database and Socket.IO are failing');
      console.log('   This suggests a fundamental system issue');
    }
    
    // 6. Cleanup
    console.log('\n6️⃣ Cleaning up...');
    await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
    console.log('   ✅ Test notification cleaned up');
    
    socket.disconnect();
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await pool.end();
  }
}

// Run the test
testRealtimeNotifications();
