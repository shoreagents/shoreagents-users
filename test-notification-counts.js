const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testNotificationCounts() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing notification counts...\n');
    
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
    
    // Get total notifications for user
    const totalResult = await client.query(`
      SELECT COUNT(*) as total FROM notifications WHERE user_id = $1
    `, [user.id]);
    
    // Get unread notifications for user
    const unreadResult = await client.query(`
      SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND is_read = false
    `, [user.id]);
    
    // Get recent notifications (last 8)
    const recentResult = await client.query(`
      SELECT id, title, message, is_read, created_at, category, type
      FROM notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 8
    `, [user.id]);
    
    console.log(`\n📊 Notification counts:`);
    console.log(`   Total notifications: ${totalResult.rows[0].total}`);
    console.log(`   Unread notifications: ${unreadResult.rows[0].unread}`);
    console.log(`   Recent notifications (last 8): ${recentResult.rows.length}`);
    
    console.log(`\n📋 Recent notifications:`);
    recentResult.rows.forEach((notif, index) => {
      console.log(`   ${index + 1}. [${notif.is_read ? 'READ' : 'UNREAD'}] ${notif.title}`);
      console.log(`      Message: ${notif.message.substring(0, 50)}...`);
      console.log(`      Created: ${notif.created_at}`);
      console.log(`      Category: ${notif.category}, Type: ${notif.type}`);
      console.log('');
    });
    
    // Check if there are any unread notifications that should be marked as read
    if (unreadResult.rows[0].unread > 0) {
      console.log(`\n🔍 Found ${unreadResult.rows[0].unread} unread notifications`);
      console.log('💡 These should be marked as read when you click "Mark All Read"');
      
      // Show which notifications are unread
      const unreadDetails = await client.query(`
        SELECT id, title, created_at
        FROM notifications 
        WHERE user_id = $1 AND is_read = false
        ORDER BY created_at DESC
      `, [user.id]);
      
      console.log('\n📋 Unread notification details:');
      unreadDetails.rows.forEach((notif, index) => {
        console.log(`   ${index + 1}. ID: ${notif.id} - ${notif.title}`);
        console.log(`      Created: ${notif.created_at}`);
      });
    } else {
      console.log('\n✅ All notifications are marked as read');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testNotificationCounts().catch(console.error);
