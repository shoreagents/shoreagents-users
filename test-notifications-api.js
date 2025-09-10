const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testNotificationsAPI() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing notifications API logic...\n');
    
    const email = 'agent@shoreagents.com';
    const limit = 1000;
    
    console.log(`📡 Testing with email: ${email}, limit: ${limit}`);
    
    // Simulate the API query
    const rows = await client.query(`
      SELECT n.id, n.user_id, n.category, n.type, n.title, n.message, n.payload, n.is_read, n.created_at
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE u.email = $1 AND (n.clear IS NULL OR n.clear = false)
      ORDER BY n.created_at DESC
      LIMIT $2
    `, [email, limit]);
    
    // Get total unread count
    const unreadCountResult = await client.query(`
      SELECT COUNT(*) as unread_count
      FROM notifications n
      JOIN users u ON u.id = n.user_id
      WHERE u.email = $1 AND (n.clear IS NULL OR n.clear = false) AND n.is_read = false
    `, [email]);
    
    const totalUnreadCount = unreadCountResult.rows[0]?.unread_count || 0;
    
    console.log(`✅ API simulation successful!`);
    console.log(`   Total notifications: ${rows.rows.length}`);
    console.log(`   Total unread count: ${totalUnreadCount}`);
    
    if (rows.rows.length > 0) {
      const unreadNotifications = rows.rows.filter(n => !n.is_read);
      console.log(`   Unread notifications in result: ${unreadNotifications.length}`);
      
      if (unreadNotifications.length > 0) {
        console.log(`\n📋 First few unread notifications:`);
        unreadNotifications.slice(0, 3).forEach((notif, index) => {
          console.log(`   ${index + 1}. ID: ${notif.id} - ${notif.title}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
testNotificationsAPI().catch(console.error);
