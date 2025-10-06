require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function checkBreakNotificationsForUser2() {
  let pool;
  
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      console.log('💡 Make sure you have a .env.local file with DATABASE_URL=postgresql://...');
      return;
    }
    
    console.log('🔍 Checking break notifications for User ID 2...\n');
    console.log('🔗 Database URL:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    const client = await pool.connect();
    
    // Get user info first
    const userQuery = `
      SELECT u.id, u.email, pi.first_name, pi.last_name 
      FROM users u
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE u.id = 2
    `;
    const userResult = await client.query(userQuery);
    
    if (userResult.rows.length === 0) {
      console.log('❌ User with ID 2 not found');
      return;
    }
    
    const user = userResult.rows[0];
    const userName = user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : 'Unknown Name';
    console.log(`👤 User: ${userName} (${user.email})`);
    console.log('=' .repeat(60));
    
    // Query break notifications for user 2
    const notificationsQuery = `
      SELECT 
        n.id,
        n.title,
        n.message,
        n.type,
        n.category,
        n.is_read,
        n.created_at,
        n.payload,
        CASE 
          WHEN n.payload->>'notification_type' IS NOT NULL 
          THEN n.payload->>'notification_type'
          ELSE 'unknown'
        END as notification_type,
        CASE 
          WHEN n.payload->>'break_type' IS NOT NULL 
          THEN n.payload->>'break_type'
          ELSE 'unknown'
        END as break_type
      FROM notifications n
      WHERE n.user_id = 2 
        AND n.category = 'break'
        AND n.clear = false
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    
    const notificationsResult = await client.query(notificationsQuery);
    
    if (notificationsResult.rows.length === 0) {
      console.log('📭 No break notifications found for this user');
      return;
    }
    
    console.log(`📬 Found ${notificationsResult.rows.length} break notifications:\n`);
    
    // Group notifications by type
    const notificationTypes = {
      'available_soon': [],
      'available_now': [],
      'missed_break': [],
      'ending_soon': [],
      'other': []
    };
    
    notificationsResult.rows.forEach(notif => {
      const type = notif.notification_type;
      if (notificationTypes[type]) {
        notificationTypes[type].push(notif);
      } else {
        notificationTypes.other.push(notif);
      }
    });
    
    // Display notifications by type
    Object.entries(notificationTypes).forEach(([type, notifications]) => {
      if (notifications.length > 0) {
        console.log(`\n🔔 ${type.toUpperCase()} NOTIFICATIONS (${notifications.length}):`);
        console.log('-'.repeat(50));
        
        notifications.forEach((notif, index) => {
          const timeAgo = getTimeAgo(notif.created_at);
          const readStatus = notif.is_read ? '✅' : '⭕';
          const breakType = notif.break_type !== 'unknown' ? ` [${notif.break_type}]` : '';
          
          console.log(`${index + 1}. ${readStatus} ${notif.title}${breakType}`);
          console.log(`   📝 ${notif.message}`);
          console.log(`   ⏰ ${timeAgo} (${notif.created_at})`);
          console.log(`   🏷️  Type: ${notif.type} | Category: ${notif.category}`);
          if (notif.payload && Object.keys(notif.payload).length > 0) {
            console.log(`   📦 Payload: ${JSON.stringify(notif.payload, null, 2).replace(/\n/g, '\n        ')}`);
          }
          console.log('');
        });
      }
    });
    
    // Summary statistics
    console.log('\n📊 SUMMARY:');
    console.log('=' .repeat(30));
    Object.entries(notificationTypes).forEach(([type, notifications]) => {
      if (notifications.length > 0) {
        const unreadCount = notifications.filter(n => !n.is_read).length;
        console.log(`${type}: ${notifications.length} total (${unreadCount} unread)`);
      }
    });
    
    // Check for recent notifications (last 24 hours)
    const recentQuery = `
      SELECT COUNT(*) as count
      FROM notifications n
      WHERE n.user_id = 2 
        AND n.category = 'break'
        AND n.clear = false
        AND n.created_at > NOW() - INTERVAL '24 hours'
    `;
    
    const recentResult = await client.query(recentQuery);
    console.log(`\n⏰ Recent notifications (24h): ${recentResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error checking break notifications:', error);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// Run the script
checkBreakNotificationsForUser2().catch(console.error);
