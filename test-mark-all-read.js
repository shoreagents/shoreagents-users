const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testMarkAllRead() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing mark all read functionality...\n');
    
    // Get user ID
    const userResult = await client.query(`
      SELECT id, email FROM users WHERE email = 'agent@shoreagents.com' LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`👤 User: ${user.email} (ID: ${user.id})`);
    
    // Get unread count before
    const beforeResult = await client.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false
    `, [user.id]);
    
    const beforeCount = parseInt(beforeResult.rows[0].unread);
    console.log(`📊 Unread notifications before: ${beforeCount}`);
    
    if (beforeCount === 0) {
      console.log('✅ All notifications are already marked as read');
      return;
    }
    
    // Get all unread notification IDs
    const unreadResult = await client.query(`
      SELECT id FROM notifications WHERE user_id = $1 AND is_read = false
    `, [user.id]);
    
    const unreadIds = unreadResult.rows.map(row => row.id);
    console.log(`🔄 Found ${unreadIds.length} unread notifications to mark as read`);
    
    // Mark all as read
    const updateResult = await client.query(`
      UPDATE notifications 
      SET is_read = true
      WHERE user_id = $1 AND is_read = false
      RETURNING id
    `, [user.id]);
    
    console.log(`✅ Successfully marked ${updateResult.rows.length} notifications as read`);
    
    // Get unread count after
    const afterResult = await client.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false
    `, [user.id]);
    
    const afterCount = parseInt(afterResult.rows[0].unread);
    console.log(`📊 Unread notifications after: ${afterCount}`);
    
    if (afterCount === 0) {
      console.log('🎉 All notifications successfully marked as read!');
    } else {
      console.log(`❌ Still ${afterCount} unread notifications remaining`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testMarkAllRead().catch(console.error);
