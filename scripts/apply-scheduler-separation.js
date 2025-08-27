const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applySchedulerSeparation() {
  console.log('🔧 Applying Scheduler Separation\n');
  
  try {
    // 1. Update the check_break_reminders function to remove task notifications
    console.log('1️⃣ Updating check_break_reminders function (removing task notifications)...');
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION public.check_break_reminders()
       RETURNS integer
       LANGUAGE plpgsql
      AS $function$
            DECLARE
                agent_record RECORD;
                notifications_sent INTEGER := 0;
                check_time TIMESTAMP;
            BEGIN
                check_time := NOW() AT TIME ZONE 'Asia/Manila';

                -- NOTE: Task notifications are now handled by a separate scheduler
                -- This function only handles break-related notifications

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

                    -- Check for missed breaks (30 minutes after break becomes available)
                    -- This will send "You have not taken your [Break] yet!" notifications
                    IF is_break_missed(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift missed breaks
                    IF is_break_missed(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_missed(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for break window ending soon (15 minutes before break window expires)
                    -- This prevents generic "Break ending soon" notifications
                    IF is_break_window_ending_soon(agent_record.user_id, 'Morning', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Morning');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'Lunch', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Lunch');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'Afternoon', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'Afternoon');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    -- Check for night shift break windows ending soon
                    IF is_break_window_ending_soon(agent_record.user_id, 'NightFirst', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightFirst');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'NightMeal', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightMeal');
                        notifications_sent := notifications_sent + 1;
                    END IF;

                    IF is_break_window_ending_soon(agent_record.user_id, 'NightSecond', check_time) THEN
                        PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon', 'NightSecond');
                        notifications_sent := notifications_sent + 1;
                    END IF;
                END LOOP;

                RETURN notifications_sent;
            END;
            $function$;
    `);
    
    console.log('   ✅ Updated check_break_reminders function (removed task notifications)');
    
    // 2. Test the separation
    console.log('\n2️⃣ Testing the separation...');
    
    // Test break reminders (should work)
    const breakResult = await pool.query('SELECT check_break_reminders()');
    console.log(`   ⏰ Break reminders test: ${breakResult.rows[0].check_break_reminders} notifications sent`);
    
    // Test task notifications separately (should work)
    const taskResult = await pool.query('SELECT check_all_task_notifications()');
    console.log(`   📋 Task notifications test: ${taskResult.rows[0].check_all_task_notifications} notifications sent`);
    
    console.log('\n✅ Scheduler separation applied successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   • Separated break reminders and task notifications into different schedulers');
    console.log('   • Break reminders: Every 1 minute (high frequency needed)');
    console.log('   • Task notifications: Every 5 minutes (lower frequency sufficient)');
    console.log('   • Each scheduler can now be controlled independently');
    console.log('   • Better resource management and debugging capabilities');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Update socket-server.js to use both schedulers');
    console.log('   2. Test both schedulers independently');
    console.log('   3. Adjust timing as needed for your use case');
    
  } catch (error) {
    console.error('❌ Error applying scheduler separation:', error.message);
  } finally {
    await pool.end();
  }
}

applySchedulerSeparation().catch(console.error);
