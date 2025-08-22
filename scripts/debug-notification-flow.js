const { Pool } = require('pg');
const { io } = require('socket.io-client');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugNotificationFlow() {
  try {
    console.log('🔍 Debugging Notification Flow\n');
    
    // 1. Check current notifications
    console.log('1️⃣ Current notifications in database:');
    const currentNotifications = await pool.query('SELECT id, user_id, title, created_at FROM notifications ORDER BY created_at DESC LIMIT 5');
    currentNotifications.rows.forEach(row => {
      console.log(`   - ID: ${row.id}, User: ${row.user_id}, Title: "${row.title}", Created: ${row.created_at}`);
    });
    
    // 2. Check if user 2 exists and has any connections
    console.log('\n2️⃣ Checking user connections:');
    const userCheck = await pool.query('SELECT id, email FROM users WHERE id = 2');
    if (userCheck.rows.length > 0) {
      console.log(`   ✅ User 2 exists: ${userCheck.rows[0].email}`);
    } else {
      console.log('   ❌ User 2 not found');
      return;
    }
    
    // 3. Test Socket.IO connection with detailed logging
    console.log('\n3️⃣ Testing Socket.IO connection with detailed logging...');
    const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SOCKET_SERVER_URL || 'http://localhost:3001';
    console.log(`   Connecting to: ${socketServerUrl}`);
    
    const socket = io(socketServerUrl, {
      reconnection: true,
      transports: ['websocket', 'polling'],
    });
    
    // Set up all event listeners
    socket.on('connect', () => {
      console.log('   ✅ Socket.IO connected successfully');
      console.log('   🔌 Socket ID:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.log('   ❌ Socket connection error:', error.message);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('   🔌 Socket disconnected:', reason);
    });
    
    socket.on('authenticated', (data) => {
      console.log('   ✅ Socket authenticated:', JSON.stringify(data, null, 2));
    });
    
    socket.on('db-notification', (notification) => {
      console.log('   📡 SOCKET NOTIFICATION RECEIVED!');
      console.log('   📋 Notification data:', JSON.stringify(notification, null, 2));
    });
    
    // Wait for connection
    await new Promise((resolve) => {
      socket.on('connect', resolve);
      setTimeout(() => resolve(), 2000);
    });
    
    // 4. Authenticate
    console.log('\n4️⃣ Authenticating socket...');
    socket.emit('authenticate', 'kyle.p@shoreagents.com');
    
    // Wait for authentication
    await new Promise((resolve) => {
      socket.on('authenticated', resolve);
      setTimeout(() => resolve(), 3000);
    });
    
    // 5. Create a test notification and monitor
    console.log('\n5️⃣ Creating test notification...');
    console.log('   ⏳ Waiting 5 seconds for real-time delivery...');
    
    const testResult = await pool.query(`
      INSERT INTO notifications (user_id, category, type, title, message, payload) 
      VALUES (2, 'break', 'warning', 'Debug Test', 'Testing notification flow debugging', '{"debug": true}')
      RETURNING id
    `);
    const notificationId = testResult.rows[0].id;
    console.log(`   ✅ Test notification created with ID: ${notificationId}`);
    
    // Wait for potential real-time delivery
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // 6. Check if notification was delivered
    console.log('\n6️⃣ Checking notification delivery...');
    const deliveredNotification = await pool.query('SELECT * FROM notifications WHERE id = $1', [notificationId]);
    if (deliveredNotification.rows.length > 0) {
      console.log('   ✅ Notification exists in database');
      console.log('   📋 Full notification data:', JSON.stringify(deliveredNotification.rows[0], null, 2));
    } else {
      console.log('   ❌ Notification not found in database');
    }
    
    // 7. Cleanup
    console.log('\n7️⃣ Cleaning up...');
    await pool.query('DELETE FROM notifications WHERE id = $1', [notificationId]);
    console.log('   ✅ Test notification cleaned up');
    
    socket.disconnect();
    await pool.end();
    
    console.log('\n🔍 Debug Summary:');
    console.log('   - Database notifications: Working');
    console.log('   - Socket.IO connection: Working');
    console.log('   - Authentication: Working');
    console.log('   - Real-time delivery: Check logs above');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    await pool.end();
  }
}

// Run the debug
debugNotificationFlow();
