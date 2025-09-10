const { Pool } = require('pg');
const { io } = require('socket.io-client');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFrontendRealtime() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing frontend real-time updates...\n');
    
    // Step 1: Connect to socket server
    console.log('🔌 Connecting to socket server...');
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true
    });
    
    let socketConnected = false;
    let socketAuthenticated = false;
    
    socket.on('connect', () => {
      console.log('   ✅ Socket connected');
      socketConnected = true;
      
      // Authenticate
      socket.emit('authenticate', { 
        email: 'agent@shoreagents.com',
        userId: 2 
      });
    });
    
    socket.on('authenticated', (data) => {
      console.log('   ✅ Socket authenticated');
      socketAuthenticated = true;
    });
    
    socket.on('connect_error', (error) => {
      console.log('   ❌ Socket connection error:', error.message);
    });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!socketConnected || !socketAuthenticated) {
      console.log('❌ Socket connection failed');
      return;
    }
    
    // Step 2: Listen for events
    console.log('\n👂 Listening for socket events...');
    let eventChangeReceived = false;
    let eventUpdatedReceived = false;
    
    socket.on('event-change', (data) => {
      console.log('   📡 Received event-change:', data.type, 'Event ID:', data.eventId);
      eventChangeReceived = true;
    });
    
    socket.on('event-updated', (data) => {
      console.log('   📡 Received event-updated:', data.type, 'Event ID:', data.eventId);
      eventUpdatedReceived = true;
    });
    
    // Step 3: Get event details
    const eventResult = await client.query(`
      SELECT id, title, status, event_date, start_time, end_time
      FROM events 
      WHERE title LIKE '%Training Workshop%'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (eventResult.rows.length === 0) {
      console.log('❌ No events found');
      return;
    }
    
    const event = eventResult.rows[0];
    console.log(`\n📊 Event details: ${event.title} (ID: ${event.id})`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Start Time: ${event.start_time}`);
    
    // Step 4: Trigger event update
    console.log('\n🔄 Triggering event update...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [event.id]);
      console.log('   ✅ Event update triggered');
    } catch (error) {
      console.log('   ❌ Error triggering event update:', error.message);
    }
    
    // Step 5: Wait for events
    console.log('\n⏰ Waiting for socket events...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 6: Check results
    console.log('\n📋 Results:');
    console.log(`   Event Change Received: ${eventChangeReceived ? '✅' : '❌'}`);
    console.log(`   Event Updated Received: ${eventUpdatedReceived ? '✅' : '❌'}`);
    
    if (eventChangeReceived || eventUpdatedReceived) {
      console.log('\n✅ Socket events are working!');
      console.log('💡 The issue is in the frontend event handling');
      console.log('💡 Check the browser console for debug messages');
    } else {
      console.log('\n❌ No socket events received!');
      console.log('💡 The issue is in the socket server broadcasting');
    }
    
    // Clean up
    socket.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testFrontendRealtime().catch(console.error);
