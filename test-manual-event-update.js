const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testManualEventUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing manual event update to trigger real-time notifications...\n');
    
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
    console.log(`📊 Current event status: ${event.status}`);
    
    // Manually update the event to trigger the notify_event_change function
    console.log('🔄 Manually updating event to trigger notifications...');
    
    const updateResult = await client.query(`
      UPDATE events 
      SET updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
      WHERE id = $1
      RETURNING id, title, status, updated_at
    `, [event.id]);
    
    if (updateResult.rows.length > 0) {
      const updatedEvent = updateResult.rows[0];
      console.log(`   ✅ Event updated successfully`);
      console.log(`   Event ID: ${updatedEvent.id}`);
      console.log(`   Title: ${updatedEvent.title}`);
      console.log(`   Status: ${updatedEvent.status}`);
      console.log(`   Updated At: ${updatedEvent.updated_at}`);
    }
    
    // Also test the notify_event_status_change function
    console.log('\n🔔 Testing notify_event_status_change function...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [event.id]);
      console.log('   ✅ notify_event_status_change function executed successfully');
    } catch (error) {
      console.log('   ❌ Error calling notify_event_status_change:', error.message);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('💡 Check if the frontend updates in real-time now');
    console.log('💡 If not, check the browser console for socket connection errors');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testManualEventUpdate().catch(console.error);
