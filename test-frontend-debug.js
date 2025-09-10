const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testFrontendDebug() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing frontend debugging...\n');
    console.log('📋 Instructions:');
    console.log('1. Open the events page in your browser');
    console.log('2. Open the browser console (F12 → Console)');
    console.log('3. Look for these debug messages:');
    console.log('   - 🔌 Socket connected: [socket-id]');
    console.log('   - 🔐 Authenticating with email: [email]');
    console.log('   - ✅ Socket authenticated: [data]');
    console.log('   - 🔍 useEvents useEffect triggered: [data]');
    console.log('   - ✅ useEvents useEffect: Setting up event listeners');
    console.log('4. Run this script to trigger an event update');
    console.log('5. Watch for these messages in the console:');
    console.log('   - 🔄 Event change received: [data]');
    console.log('   - 🔄 Event updated received: [data]');
    console.log('   - ✅ Fresh events data fetched: [count] events');
    console.log('\n⏰ Waiting 5 seconds before triggering event update...\n');
    
    // Wait for user to check console
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get the event
    const eventResult = await client.query(`
      SELECT id, title, status
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
    console.log(`🔄 Triggering event update for: ${event.title} (ID: ${event.id})`);
    
    // Trigger the event update
    await client.query(`
      SELECT notify_event_status_change($1, 'upcoming', 'today')
    `, [event.id]);
    
    console.log('✅ Event update triggered!');
    console.log('💡 Check the browser console for real-time update messages');
    console.log('💡 If you see the debug messages, the issue is in the event handling');
    console.log('💡 If you don\'t see the debug messages, the issue is in the socket connection');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testFrontendDebug().catch(console.error);
