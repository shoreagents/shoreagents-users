const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function disableNotificationTrigger() {
  try {
    console.log('🔕 Disabling notification trigger to reduce console logs...');
    
    // Drop the notification trigger
    await pool.query('DROP TRIGGER IF EXISTS notify_activity_data_change ON activity_data;');
    
    console.log('✅ Notification trigger disabled successfully!');
    console.log('📝 Console logs should now be much cleaner');
    console.log('🔄 Real-time functionality still works through Socket.IO');
    
  } catch (error) {
    console.error('❌ Error disabling notification trigger:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

disableNotificationTrigger().catch(console.error); 