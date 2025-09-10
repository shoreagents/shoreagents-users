const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testEventStatusUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing event status update and real-time notifications...\n');
    
    // First, let's check the current status of the event
    console.log('📊 Current event status:');
    const currentStatus = await client.query(`
      SELECT id, title, status, event_date, start_time, end_time
      FROM events 
      WHERE title LIKE '%Training Workshop%'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (currentStatus.rows.length > 0) {
      const event = currentStatus.rows[0];
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Date: ${event.event_date}`);
      console.log(`   Start Time: ${event.start_time}`);
      console.log(`   End Time: ${event.end_time}`);
    } else {
      console.log('❌ No events found');
      return;
    }
    
    // Test the update_all_event_statuses function
    console.log('\n🔄 Running update_all_event_statuses function...');
    const result = await client.query('SELECT * FROM update_all_event_statuses()');
    const updateResult = result.rows[0];
    
    console.log(`   Updated Count: ${updateResult.updated_count}`);
    console.log(`   Details: ${updateResult.details}`);
    
    // Check the status again
    console.log('\n📊 Event status after update:');
    const newStatus = await client.query(`
      SELECT id, title, status, event_date, start_time, end_time
      FROM events 
      WHERE title LIKE '%Training Workshop%'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (newStatus.rows.length > 0) {
      const event = newStatus.rows[0];
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Date: ${event.event_date}`);
      console.log(`   Start Time: ${event.start_time}`);
      console.log(`   End Time: ${event.end_time}`);
    }
    
    // Test the notify_event_status_change function directly
    console.log('\n🔔 Testing notify_event_status_change function...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [currentStatus.rows[0].id]);
      console.log('   ✅ notify_event_status_change function executed successfully');
    } catch (error) {
      console.log('   ❌ Error calling notify_event_status_change:', error.message);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('💡 Check the socket server logs to see if notifications were sent');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testEventStatusUpdate().catch(console.error);
