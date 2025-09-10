const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testGlobalIndicator() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing global event indicator real-time updates...\n');
    
    // Get current time
    const now = new Date();
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const currentTime = philippinesTime.toLocaleTimeString('en-US', { 
      hour12: true, 
      timeZone: 'Asia/Manila' 
    });
    
    console.log(`📅 Current Philippines time: ${currentTime}`);
    
    // Get the event details
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
    
    // Check if event should have started
    const eventStartTime = new Date(`${event.event_date} ${event.start_time}`);
    const eventStartTimePH = new Date(eventStartTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const shouldHaveStarted = philippinesTime >= eventStartTimePH;
    
    console.log(`\n⏰ Time comparison:`);
    console.log(`   Event start time: ${eventStartTimePH.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Current time: ${philippinesTime.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Should have started: ${shouldHaveStarted ? '✅ YES' : '❌ NO'}`);
    
    if (shouldHaveStarted) {
      console.log('\n✅ Event should have started!');
      console.log('💡 The global event indicator should now appear immediately');
      console.log('💡 Check if the global event indicator appears in the browser');
      console.log('💡 It should appear at the same time as the event page updates');
    } else {
      console.log('\n⏰ Event has not started yet');
      console.log('💡 Wait for the event to start, then check the global indicator');
    }
    
    // Trigger a manual event update to test real-time updates
    console.log('\n🔄 Triggering manual event update...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [event.id]);
      console.log('   ✅ Event update triggered');
      console.log('💡 The global event indicator should update immediately now');
    } catch (error) {
      console.log('   ❌ Error triggering event update:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testGlobalIndicator().catch(console.error);
