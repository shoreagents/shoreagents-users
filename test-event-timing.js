const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testEventTiming() {
  const client = await pool.connect();
  
  try {
    console.log('🕐 Testing event timing...\n');
    
    // Get current time in Philippines timezone
    const now = new Date();
    const philippinesTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    const currentTime = philippinesTime.toLocaleTimeString('en-US', { 
      hour12: true, 
      timeZone: 'Asia/Manila' 
    });
    
    console.log(`📅 Current Philippines time: ${currentTime}`);
    console.log(`📅 Current time object: ${philippinesTime.toISOString()}`);
    
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
    console.log(`\n📊 Event details:`);
    console.log(`   Event ID: ${event.id}`);
    console.log(`   Title: ${event.title}`);
    console.log(`   Status: ${event.status}`);
    console.log(`   Date: ${event.event_date}`);
    console.log(`   Start Time: ${event.start_time}`);
    console.log(`   End Time: ${event.end_time}`);
    
    // Check if event should have started
    // Parse the event date properly
    let eventDateStr;
    if (typeof event.event_date === 'string') {
      eventDateStr = event.event_date.includes('T') ? event.event_date.split('T')[0] : event.event_date;
    } else {
      // It's a Date object - get the date in Philippines timezone
      const eventDateInPH = new Date(event.event_date);
      // Convert to Philippines timezone and get the date
      const year = eventDateInPH.getFullYear();
      const month = String(eventDateInPH.getMonth() + 1).padStart(2, '0');
      const day = String(eventDateInPH.getDate()).padStart(2, '0');
      eventDateStr = `${year}-${month}-${day}`;
    }
    
    const eventStartTime = new Date(`${eventDateStr} ${event.start_time}`);
    const eventStartTimePH = new Date(eventStartTime.toLocaleString("en-US", {timeZone: "Asia/Manila"}));
    
    console.log(`\n⏰ Time comparison:`);
    console.log(`   Event start time: ${eventStartTimePH.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Current time: ${philippinesTime.toLocaleTimeString('en-US', { hour12: true })}`);
    console.log(`   Should have started: ${philippinesTime >= eventStartTimePH ? '✅ YES' : '❌ NO'}`);
    
    // Check if the event status should be updated
    const todayStr = philippinesTime.toISOString().split('T')[0];
    const shouldBeToday = eventDateStr === todayStr;
    const shouldHaveStarted = philippinesTime >= eventStartTimePH;
    
    console.log(`\n🔍 Status analysis:`);
    console.log(`   Event date string: ${eventDateStr}`);
    console.log(`   Today string: ${todayStr}`);
    console.log(`   Event date is today: ${shouldBeToday ? '✅ YES' : '❌ NO'}`);
    console.log(`   Event should have started: ${shouldHaveStarted ? '✅ YES' : '❌ NO'}`);
    console.log(`   Current status: ${event.status}`);
    
    if (shouldBeToday && shouldHaveStarted && event.status === 'today') {
      console.log(`\n✅ Event is correctly in 'today' status and should have started`);
      console.log(`💡 The issue is likely in the frontend not updating in real-time`);
    } else if (shouldBeToday && shouldHaveStarted && event.status !== 'today') {
      console.log(`\n❌ Event should be in 'today' status but isn't`);
      console.log(`💡 Running update_all_event_statuses to fix this`);
      
      const result = await client.query('SELECT * FROM update_all_event_statuses()');
      const updateResult = result.rows[0];
      console.log(`   Updated Count: ${updateResult.updated_count}`);
      console.log(`   Details: ${updateResult.details}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testEventTiming().catch(console.error);
