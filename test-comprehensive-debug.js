const { Pool } = require('pg');
const { io } = require('socket.io-client');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testComprehensiveDebug() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Comprehensive debugging test...\n');
    
    // Step 1: Check current event status
    console.log('📊 Step 1: Checking current event status...');
    const eventResult = await client.query(`
      SELECT id, title, status, event_date, start_time, end_time, updated_at
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
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Title: ${event.title}`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Start Time: ${event.start_time}`);
    console.log(`   Updated At: ${event.updated_at}`);
    
    // Step 2: Test socket connection
    console.log('\n🔌 Step 2: Testing socket connection...');
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
    
    // Step 3: Wait for socket connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (!socketConnected) {
      console.log('   ❌ Socket connection failed');
      return;
    }
    
    if (!socketAuthenticated) {
      console.log('   ❌ Socket authentication failed');
      return;
    }
    
    // Step 4: Listen for events
    console.log('\n👂 Step 3: Listening for socket events...');
    let eventChangeReceived = false;
    let eventUpdatedReceived = false;
    
    socket.on('event-change', (data) => {
      console.log('   📡 Received event-change:', data);
      eventChangeReceived = true;
    });
    
    socket.on('event-updated', (data) => {
      console.log('   📡 Received event-updated:', data);
      eventUpdatedReceived = true;
    });
    
    socket.on('event-attendance-change', (data) => {
      console.log('   📡 Received event-attendance-change:', data);
    });
    
    // Step 5: Trigger event update
    console.log('\n🔄 Step 4: Triggering event update...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [event.id]);
      console.log('   ✅ notify_event_status_change executed');
    } catch (error) {
      console.log('   ❌ Error calling notify_event_status_change:', error.message);
    }
    
    // Step 6: Wait for events
    console.log('\n⏰ Step 5: Waiting for socket events...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 7: Check results
    console.log('\n📋 Step 6: Results summary...');
    console.log(`   Socket Connected: ${socketConnected ? '✅' : '❌'}`);
    console.log(`   Socket Authenticated: ${socketAuthenticated ? '✅' : '❌'}`);
    console.log(`   Event Change Received: ${eventChangeReceived ? '✅' : '❌'}`);
    console.log(`   Event Updated Received: ${eventUpdatedReceived ? '✅' : '❌'}`);
    
    if (!eventChangeReceived && !eventUpdatedReceived) {
      console.log('\n❌ No socket events received!');
      console.log('   This means the socket server is not broadcasting events properly');
      console.log('   Check the socket server logs for errors');
    } else {
      console.log('\n✅ Socket events are working!');
      console.log('   The issue might be in the frontend event handling');
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
testComprehensiveDebug().catch(console.error);
