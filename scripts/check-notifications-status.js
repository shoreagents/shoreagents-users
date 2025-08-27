const { Pool } = require('pg');
require('dotenv').config({ path: '../.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkNotifications() {
  try {
    console.log('🔍 Checking notifications status for user 2...\n');
    
    const result = await pool.query(`
      SELECT id, user_id, type, title, message, is_read, created_at 
      FROM notifications 
      WHERE user_id = 2 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('📋 Current notifications for user 2:');
    console.log('─'.repeat(80));
    
    result.rows.forEach(row => {
      const status = row.is_read ? '✅ READ' : '❌ UNREAD';
      console.log(`${status} | ID: ${row.id} | ${row.title} | Created: ${row.created_at}`);
    });
    
    const unreadCount = result.rows.filter(row => !row.is_read).length;
    const totalCount = result.rows.length;
    
    console.log('─'.repeat(80));
    console.log(`📊 Summary: ${unreadCount}/${totalCount} notifications are unread`);
    
    if (unreadCount > 0) {
      console.log('\n🔍 Checking if these notifications should be marked as read...');
      
      // Check if the mark-read API endpoint is working
      const markReadResult = await pool.query(`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE user_id = 2 AND is_read = true
      `);
      
      const readCount = parseInt(markReadResult.rows[0].count);
      console.log(`📖 Total read notifications in database: ${readCount}`);
      
      // Check the specific notifications mentioned in the issue
      const specificIds = [1623, 1624];
      const specificResult = await pool.query(`
        SELECT id, is_read, title 
        FROM notifications 
        WHERE id = ANY($1)
      `, [specificIds]);
      
      console.log('\n🎯 Specific notifications mentioned in issue:');
      specificResult.rows.forEach(row => {
        const status = row.is_read ? '✅ READ' : '❌ UNREAD';
        console.log(`${status} | ID: ${row.id} | ${row.title}`);
      });
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

checkNotifications();
