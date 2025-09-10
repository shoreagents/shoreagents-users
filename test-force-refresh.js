const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testForceRefresh() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Testing force refresh of events data...\n');
    
    // First, let's check the current event data
    console.log('📊 Current event data:');
    const eventResult = await client.query(`
      SELECT id, title, status, event_date, start_time, end_time, updated_at
      FROM events 
      WHERE title LIKE '%Training Workshop%'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (eventResult.rows.length > 0) {
      const event = eventResult.rows[0];
      console.log(`   Event ID: ${event.id}`);
      console.log(`   Title: ${event.title}`);
      console.log(`   Status: ${event.status}`);
      console.log(`   Date: ${event.event_date}`);
      console.log(`   Start Time: ${event.start_time}`);
      console.log(`   End Time: ${event.end_time}`);
      console.log(`   Updated At: ${event.updated_at}`);
    }
    
    // Test the API endpoint directly
    console.log('\n🌐 Testing API endpoint directly...');
    try {
      const response = await fetch('http://localhost:3000/api/events?bypass_cache=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('   ✅ API endpoint responded successfully');
        console.log(`   Events count: ${data.events?.length || 0}`);
        
        if (data.events && data.events.length > 0) {
          const workshopEvent = data.events.find(e => e.title.includes('Training Workshop'));
          if (workshopEvent) {
            console.log(`   Workshop Event Status: ${workshopEvent.status}`);
            console.log(`   Workshop Event Start Time: ${workshopEvent.start_time}`);
          }
        }
      } else {
        console.log(`   ❌ API endpoint failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`   ❌ API endpoint error: ${error.message}`);
    }
    
    // Test Redis cache clearing
    console.log('\n🗑️ Testing Redis cache clearing...');
    try {
      const redis = require('redis');
      const redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });
      
      await redisClient.connect();
      await redisClient.del('events:*');
      console.log('   ✅ Redis cache cleared successfully');
      await redisClient.disconnect();
    } catch (error) {
      console.log(`   ❌ Redis cache error: ${error.message}`);
    }
    
    console.log('\n🎉 Test completed!');
    console.log('💡 Check if the frontend updates now');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testForceRefresh().catch(console.error);
