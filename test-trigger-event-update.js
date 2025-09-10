const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTriggerEventUpdate() {
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
    
    // Manually trigger the notify_event_status_change function
    console.log('🔔 Triggering notify_event_status_change function...');
    try {
      await client.query(`
        SELECT notify_event_status_change($1, 'upcoming', 'today')
      `, [event.id]);
      console.log('   ✅ notify_event_status_change function executed successfully');
    } catch (error) {
      console.log('   ❌ Error calling notify_event_status_change:', error.message);
    }
    
    // Also test the update_all_event_statuses function
    console.log('\n🔄 Running update_all_event_statuses function...');
    try {
      const result = await client.query('SELECT * FROM update_all_event_statuses()');
      const updateResult = result.rows[0];
      console.log(`   Updated Count: ${updateResult.updated_count}`);
      console.log(`   Details: ${updateResult.details}`);
    } catch (error) {
      console.log('   ❌ Error calling update_all_event_statuses:', error.message);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('💡 Check the browser console for real-time update messages');
    console.log('💡 The frontend should now show updated event status');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testTriggerEventUpdate().catch(console.error);
