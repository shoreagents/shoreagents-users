require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function testBreakNotificationsForUser2() {
  let pool;
  
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL environment variable is not set');
      console.log('💡 Make sure you have a .env.local file with DATABASE_URL=postgresql://...');
      return;
    }
    
    console.log('🧪 Testing Break Notifications System for User ID 2...\n');
    console.log('🔗 Database URL:', process.env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'));
    
    // Create database connection
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    
    const client = await pool.connect();
    
    // 1. Check user info
    console.log('\n📋 STEP 1: User Information');
    console.log('=' .repeat(50));
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
    
    // 2. Check break configurations
    console.log('\n📋 STEP 2: Break Configurations');
    console.log('=' .repeat(50));
    const breakConfigQuery = `
      SELECT 
        break_type,
        start_time,
        end_time,
        duration_minutes,
        is_active,
        created_at
      FROM breaks 
      WHERE user_id = 2 
      ORDER BY break_type
    `;
    const breakConfigResult = await client.query(breakConfigQuery);
    
    if (breakConfigResult.rows.length === 0) {
      console.log('❌ No break configurations found for user 2');
      console.log('💡 User needs to configure their break schedule first');
      return;
    }
    
    console.log(`✅ Found ${breakConfigResult.rows.length} break configurations:`);
    breakConfigResult.rows.forEach(config => {
      console.log(`   • ${config.break_type}: ${config.start_time} - ${config.end_time} (${config.duration_minutes} min) - ${config.is_active ? 'Active' : 'Inactive'}`);
    });
    
    // 3. Check current break sessions
    console.log('\n📋 STEP 3: Current Break Sessions');
    console.log('=' .repeat(50));
    const sessionsQuery = `
      SELECT 
        id,
        break_type,
        start_time,
        end_time,
        duration_minutes,
        break_date,
        is_expired,
        created_at
      FROM break_sessions 
      WHERE agent_user_id = 2 
        AND break_date = CURRENT_DATE
      ORDER BY created_at DESC
    `;
    const sessionsResult = await client.query(sessionsQuery);
    
    console.log(`📊 Today's break sessions: ${sessionsResult.rows.length}`);
    sessionsResult.rows.forEach(session => {
      const status = session.end_time ? 'Completed' : (session.is_expired ? 'Expired' : 'Active');
      console.log(`   • ${session.break_type}: ${session.start_time} - ${session.end_time || 'Ongoing'} (${status})`);
    });
    
    // 4. Test break availability functions with timing details
    console.log('\n📋 STEP 4: Testing Break Availability Functions with Timing');
    console.log('=' .repeat(50));
    
    const currentTime = new Date();
    const manilaTime = new Date(currentTime.getTime() + (8 * 60 * 60 * 1000)); // UTC + 8 hours
    console.log(`🕐 Current UTC time: ${currentTime.toISOString()}`);
    console.log(`🕐 Current Manila time: ${manilaTime.toISOString()}`);
    console.log(`🕐 Current Manila time only: ${manilaTime.toTimeString().split(' ')[0]}`);
    
    for (const config of breakConfigResult.rows) {
      if (!config.is_active) continue;
      
      console.log(`\n🔍 Testing ${config.break_type} break:`);
      console.log(`   📅 Break window: ${config.start_time} - ${config.end_time}`);
      
      // Calculate notification times
      const startTime = new Date(`1970-01-01T${config.start_time}`);
      const endTime = new Date(`1970-01-01T${config.end_time}`);
      const currentTimeOnly = new Date(`1970-01-01T${manilaTime.toTimeString().split(' ')[0]}`);
      
      // Available soon: 15 minutes before start time
      const availableSoonTime = new Date(startTime.getTime() - (15 * 60 * 1000));
      const availableSoonTimeStr = availableSoonTime.toTimeString().split(' ')[0];
      
      // Available now: at start time
      const availableNowTimeStr = config.start_time;
      
      // Missed: 30 minutes after start time
      const missedTime = new Date(startTime.getTime() + (30 * 60 * 1000));
      const missedTimeStr = missedTime.toTimeString().split(' ')[0];
      
      // Ending soon: 15 minutes before end time
      const endingSoonTime = new Date(endTime.getTime() - (15 * 60 * 1000));
      const endingSoonTimeStr = endingSoonTime.toTimeString().split(' ')[0];
      
      console.log(`   ⏰ Notification schedule:`);
      console.log(`      • Available soon: ${availableSoonTimeStr} (15 min before ${config.start_time})`);
      console.log(`      • Available now: ${availableNowTimeStr} (at start time)`);
      console.log(`      • Missed: ${missedTimeStr} (30 min after ${config.start_time})`);
      console.log(`      • Ending soon: ${endingSoonTimeStr} (15 min before ${config.end_time})`);
      
      // Test current status
      const availableNowQuery = `SELECT is_break_available_now(2, '${config.break_type}') as available_now`;
      const availableNowResult = await client.query(availableNowQuery);
      console.log(`   • Available now: ${availableNowResult.rows[0].available_now}`);
      
      const availableSoonQuery = `SELECT is_break_available_soon(2, '${config.break_type}') as available_soon`;
      const availableSoonResult = await client.query(availableSoonQuery);
      console.log(`   • Available soon: ${availableSoonResult.rows[0].available_soon}`);
      
      const missedQuery = `SELECT is_break_missed(2, '${config.break_type}') as missed`;
      const missedResult = await client.query(missedQuery);
      console.log(`   • Missed: ${missedResult.rows[0].missed}`);
      
      const endingSoonQuery = `SELECT is_break_window_ending_soon(2, '${config.break_type}') as ending_soon`;
      const endingSoonResult = await client.query(endingSoonQuery);
      console.log(`   • Ending soon: ${endingSoonResult.rows[0].ending_soon}`);
    }
    
    // 5. Check recent notifications
    console.log('\n📋 STEP 5: Recent Break Notifications');
    console.log('=' .repeat(50));
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
          WHEN n.payload->>'reminder_type' IS NOT NULL 
          THEN n.payload->>'reminder_type'
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
        AND n.created_at >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY n.created_at DESC
      LIMIT 20
    `;
    
    const notificationsResult = await client.query(notificationsQuery);
    
    if (notificationsResult.rows.length === 0) {
      console.log('📭 No break notifications found in the last 7 days');
    } else {
      console.log(`📬 Found ${notificationsResult.rows.length} break notifications in the last 7 days:`);
      
      // Group by notification type
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
      
      // Display by type with detailed timing
      Object.entries(notificationTypes).forEach(([type, notifications]) => {
        if (notifications.length > 0) {
          console.log(`\n🔔 ${type.toUpperCase()} (${notifications.length}):`);
          notifications.forEach((notif, index) => {
            const timeAgo = getTimeAgo(notif.created_at);
            const readStatus = notif.is_read ? '✅' : '⭕';
            const breakType = notif.break_type !== 'unknown' ? ` [${notif.break_type}]` : '';
            
            // Parse the exact time
            const notifTime = new Date(notif.created_at);
            const manilaTime = new Date(notifTime.getTime() + (8 * 60 * 60 * 1000));
            const timeStr = manilaTime.toLocaleString('en-US', {
              timeZone: 'Asia/Manila',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            });
            
            console.log(`   ${index + 1}. ${readStatus} ${notif.title}${breakType}`);
            console.log(`       📝 ${notif.message}`);
            console.log(`       ⏰ Sent: ${timeStr} (${timeAgo})`);
            console.log(`       🏷️  Type: ${notif.type} | Category: ${notif.category}`);
            if (notif.payload && Object.keys(notif.payload).length > 0) {
              console.log(`       📦 Payload: ${JSON.stringify(notif.payload, null, 2).replace(/\n/g, '\n           ')}`);
            }
            console.log('');
          });
        }
      });
    }
    
    // 6. Test notification creation functions
    console.log('\n📋 STEP 6: Testing Notification Creation');
    console.log('=' .repeat(50));
    
    // Test check_break_reminders function
    console.log('🧪 Testing check_break_reminders function...');
    try {
      const checkRemindersQuery = `SELECT check_break_reminders() as notifications_sent`;
      const checkRemindersResult = await client.query(checkRemindersQuery);
      console.log(`✅ check_break_reminders() executed successfully`);
      console.log(`📊 Notifications sent: ${checkRemindersResult.rows[0].notifications_sent}`);
    } catch (error) {
      console.log(`❌ Error testing check_break_reminders: ${error.message}`);
    }
    
    // 7. Test mark_expired_breaks function
    console.log('\n📋 STEP 7: Testing Break Expiration');
    console.log('=' .repeat(50));
    
    try {
      const markExpiredQuery = `SELECT mark_expired_breaks(2) as expired_count`;
      const markExpiredResult = await client.query(markExpiredQuery);
      console.log(`✅ mark_expired_breaks() executed successfully`);
      console.log(`📊 Expired breaks processed: ${markExpiredResult.rows[0].expired_count}`);
    } catch (error) {
      console.log(`❌ Error testing mark_expired_breaks: ${error.message}`);
    }
    
    // 8. Summary and recommendations
    console.log('\n📋 STEP 8: Summary & Recommendations');
    console.log('=' .repeat(50));
    
    const hasBreakConfig = breakConfigResult.rows.length > 0;
    const hasActiveBreaks = breakConfigResult.rows.some(b => b.is_active);
    const hasRecentNotifications = notificationsResult.rows.length > 0;
    
    console.log('📊 System Status:');
    console.log(`   • Break configurations: ${hasBreakConfig ? '✅ Configured' : '❌ Missing'}`);
    console.log(`   • Active breaks: ${hasActiveBreaks ? '✅ Active' : '❌ None active'}`);
    console.log(`   • Recent notifications: ${hasRecentNotifications ? '✅ Found' : '❌ None found'}`);
    
    if (!hasBreakConfig) {
      console.log('\n💡 RECOMMENDATION: User 2 needs to configure their break schedule');
      console.log('   Run: INSERT INTO breaks (user_id, break_type, start_time, end_time, duration_minutes, is_active) VALUES ...');
    } else if (!hasActiveBreaks) {
      console.log('\n💡 RECOMMENDATION: User 2 has break configurations but none are active');
      console.log('   Run: UPDATE breaks SET is_active = true WHERE user_id = 2');
    } else if (!hasRecentNotifications) {
      console.log('\n💡 RECOMMENDATION: No recent notifications found - check if notification scheduler is running');
      console.log('   The system should automatically send notifications based on break schedules');
    } else {
      console.log('\n✅ System appears to be working correctly!');
    }
    
  } catch (error) {
    console.error('❌ Error testing break notifications:', error);
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

// Run the test
testBreakNotificationsForUser2().catch(console.error);
