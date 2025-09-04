const { Pool } = require('pg');
const redis = require('redis');
require('dotenv').config({ path: '.env.local' });

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

async function clearMeetingsCache() {
  try {
    console.log('🔄 Connecting to Redis...');
    await redisClient.connect();
    console.log('✅ Connected to Redis');

    console.log('🔄 Clearing meetings cache...');
    
    // Clear all meetings cache keys
    const pattern = 'meetings:*';
    const keys = await redisClient.keys(pattern);
    
    if (keys.length > 0) {
      console.log(`📊 Found ${keys.length} meetings cache keys to clear:`);
      keys.forEach(key => console.log(`  - ${key}`));
      
      await redisClient.del(keys);
      console.log('✅ All meetings cache keys cleared');
    } else {
      console.log('ℹ️ No meetings cache keys found');
    }

    // Also clear any meeting status cache
    const statusPattern = 'meeting-status:*';
    const statusKeys = await redisClient.keys(statusPattern);
    
    if (statusKeys.length > 0) {
      console.log(`📊 Found ${statusKeys.length} meeting status cache keys to clear:`);
      statusKeys.forEach(key => console.log(`  - ${key}`));
      
      await redisClient.del(statusKeys);
      console.log('✅ All meeting status cache keys cleared');
    }

    console.log('🎉 Cache clearing completed successfully!');
    console.log('📝 The next API call will fetch fresh data from the database');
    
  } catch (error) {
    console.error('❌ Error clearing cache:', error);
  } finally {
    await redisClient.quit();
    await pool.end();
  }
}

clearMeetingsCache();
