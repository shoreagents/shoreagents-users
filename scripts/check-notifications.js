const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkNotifications() {
  try {
    console.log('🔍 Checking Notifications in Database...\n');
    
    // Check total notifications
    const totalResult = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM notifications
    `);
    console.log(`📊 Total notifications in database: ${totalResult.rows[0].total_count}`);
    
    // Check break notifications specifically
    const breakResult = await pool.query(`
      SELECT COUNT(*) as break_count
      FROM notifications
      WHERE category = 'break'
    `);
    console.log(`📋 Break notifications: ${breakResult.rows[0].break_count}`);
    
    // Check recent notifications for user 2
    console.log('\n📋 Recent notifications for User 2:');
    const recentResult = await pool.query(`
      SELECT 
        id,
        title,
        message,
        type,
        category,
        created_at,
        payload
      FROM notifications
      WHERE user_id = 2
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentResult.rows.length === 0) {
      console.log('   ❌ No notifications found for User 2');
    } else {
      recentResult.rows.forEach((notif, index) => {
        console.log(`   ${index + 1}. [${notif.created_at}] ${notif.title}`);
        console.log(`      Type: ${notif.type}, Category: ${notif.category}`);
        console.log(`      Message: ${notif.message}`);
        if (notif.payload) {
          console.log(`      Payload: ${JSON.stringify(notif.payload)}`);
        }
        console.log('');
      });
    }
    
    // Check if there are any unread notifications
    console.log('📋 Checking for unread notifications...');
    const unreadResult = await pool.query(`
      SELECT COUNT(*) as unread_count
      FROM notifications
      WHERE user_id = 2
      AND (payload->>'read' IS NULL OR payload->>'read' = 'false')
    `);
    console.log(`   Unread notifications: ${unreadResult.rows[0].unread_count}`);
    
    // Check notification table structure
    console.log('\n🔍 Checking notification table structure...');
    const structureResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);
    
    console.log('   Table structure:');
    structureResult.rows.forEach(col => {
      console.log(`      ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n🎉 Notification check completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNotifications();
