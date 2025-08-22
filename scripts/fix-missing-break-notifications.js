const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixMissingBreakNotifications() {
  try {
    console.log('🔧 Fixing Missing Break Notifications in check_break_reminders\n');
    
    // Update the check_break_reminders function to include missed break notifications
    console.log('1️⃣ Updating check_break_reminders function to include missed break notifications...');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_break_reminders()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          agent_record RECORD;
          notifications_sent INTEGER := 0;
          check_time TIMESTAMP;
      BEGIN
          check_time := NOW() AT TIME ZONE 'Asia/Manila';

          -- Loop through all active agents
          FOR agent_record IN
              SELECT DISTINCT u.id as user_id
              FROM users u
              INNER JOIN agents a ON u.id = a.user_id
              WHERE u.user_type = 'Agent'
          LOOP
              -- Check for breaks available soon (15 minutes before)
              IF is_break_available_soon(agent_record.user_id, 'Morning', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Morning');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_soon(agent_record.user_id, 'Lunch', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Lunch');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_soon(agent_record.user_id, 'Afternoon', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Afternoon');
                  notifications_sent := notifications_sent + 1;
              END IF;

              -- Check for night shift breaks available soon
              IF is_break_available_soon(agent_record.user_id, 'NightFirst', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightFirst');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_soon(agent_record.user_id, 'NightMeal', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightMeal');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_soon(agent_record.user_id, 'NightSecond', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightSecond');
                  notifications_sent := notifications_sent + 1;
              END IF;

              -- Check for breaks that are currently available/active (ONLY if notification not already sent)
              IF is_break_available_now(agent_record.user_id, 'Morning', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Morning', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_now(agent_record.user_id, 'Lunch', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Lunch', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'Afternoon', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
                  notifications_sent := notifications_sent + 1;
              END IF;

              -- Check for night shift breaks currently available (ONLY if notification not already sent)
              IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightFirst', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightMeal', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time)
                 AND NOT is_break_available_now_notification_sent(agent_record.user_id, 'NightSecond', check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond');
                  notifications_sent := notifications_sent + 1;
              END IF;

              -- Check for breaks ending soon
              IF is_break_ending_soon(agent_record.user_id, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
                  notifications_sent := notifications_sent + 1;
              END IF;

              -- NEW: Check for missed breaks (every 30 minutes during break window)
              IF is_break_missed(agent_record.user_id, 'Morning'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_missed(agent_record.user_id, 'Lunch'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_missed(agent_record.user_id, 'Afternoon'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_missed(agent_record.user_id, 'NightFirst'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_missed(agent_record.user_id, 'NightMeal'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
                  notifications_sent := notifications_sent + 1;
              END IF;

              IF is_break_missed(agent_record.user_id, 'NightSecond'::break_type_enum, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
                  notifications_sent := notifications_sent + 1;
              END IF;
          END LOOP;

          RETURN notifications_sent;
      END;
      $$;
    `);
    
    console.log('   ✅ Updated check_break_reminders function to include missed break notifications');
    
    // Test the updated function
    console.log('\n2️⃣ Testing the updated function...');
    const testResult = await pool.query('SELECT check_break_reminders() as notifications_sent');
    console.log(`   ✅ Function executed successfully, sent ${testResult.rows[0].notifications_sent} notifications`);
    
    // Check what notifications were created
    console.log('\n3️⃣ Checking recent notifications...');
    const notificationsResult = await pool.query(`
      SELECT title, created_at 
      FROM notifications 
      WHERE category = 'break' 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    console.log('   Recent notifications:');
    notificationsResult.rows.forEach(row => {
      console.log(`   - ${row.title} (${row.created_at})`);
    });
    
    console.log('\n🎉 Break notification system fixed!');
    console.log('📋 Now includes:');
    console.log('   • Breaks available soon (15 min before)');
    console.log('   • Breaks available now (at start time)');
    console.log('   • Breaks ending soon (15 min before end)');
    console.log('   • ✅ MISSED BREAK REMINDERS (every 30 min during break window)');
    
  } catch (error) {
    console.error('❌ Error fixing break notifications:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixMissingBreakNotifications();
