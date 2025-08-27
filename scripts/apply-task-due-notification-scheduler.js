const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyTaskDueNotificationScheduler() {
  try {
    console.log('🔧 Applying Task Due Notification Scheduler...\n');
    
    // 1. Apply the migration
    console.log('1️⃣ Applying migration 056_add_task_due_notification_scheduler.sql...');
    
    const migrationSQL = `
      -- Migration 056: Add Task Due Notification Scheduler
      -- Problem: Tasks only get notifications when created/updated, not when they become due soon over time
      -- Solution: Create a scheduled function that continuously monitors existing tasks and sends notifications

      -- Function to check for tasks that are due soon and send notifications
      CREATE OR REPLACE FUNCTION check_task_due_notifications()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        task_record RECORD;
        notifications_sent INTEGER := 0;
        now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
        hours_diff numeric;
        title_text text;
        message_text text;
      BEGIN
        -- Loop through all active tasks that have due dates
        FOR task_record IN
          SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            t.creator_id,
            -- Check if notification already sent for this task in the last 12 hours
            CASE 
              WHEN EXISTS(
                SELECT 1 FROM notifications n 
                WHERE n.user_id = t.user_id 
                AND n.category = 'task' 
                AND n.title = 'Task due soon'
                AND n.payload->>'task_id' = t.id::text
                AND n.created_at > now() - INTERVAL '12 hours'
              ) THEN true
              ELSE false
            END as notification_sent_recently
          FROM tasks t
          WHERE t.due_date IS NOT NULL 
          AND t.status = 'active'
          AND t.due_date > now_ts
          AND t.due_date <= now_ts + INTERVAL '24 hours'
        LOOP
          -- Skip if notification was sent recently (within 12 hours)
          IF task_record.notification_sent_recently THEN
            CONTINUE;
          END IF;
          
          -- Calculate hours until due
          hours_diff := EXTRACT(EPOCH FROM (task_record.due_date - now_ts)) / 3600.0;
          
          -- Send notification if due within next 24 hours
          IF hours_diff <= 24 AND hours_diff >= 0 THEN
            title_text := 'Task due soon';
            message_text := format('"%s" is due on %s', task_record.title, to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH24:MI'));
            
            -- Insert notification
            INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
            VALUES (
              task_record.user_id,
              'task',
              'warning',
              title_text,
              message_text,
              jsonb_build_object(
                'task_id', task_record.id, 
                'group_id', task_record.group_id, 
                'due_date', task_record.due_date, 
                'action_url', '/productivity/task-activity',
                'hours_until_due', round(hours_diff, 1)
              ),
              now_ts
            );
            
            notifications_sent := notifications_sent + 1;
          END IF;
        END LOOP;
        
        RETURN notifications_sent;
      END;
      $$;

      -- Function to check for overdue tasks and send notifications
      CREATE OR REPLACE FUNCTION check_overdue_task_notifications()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        task_record RECORD;
        notifications_sent INTEGER := 0;
        now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
        hours_overdue numeric;
        title_text text;
        message_text text;
      BEGIN
        -- Loop through all active overdue tasks
        FOR task_record IN
          SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            t.creator_id,
            -- Check if overdue notification already sent for this task in the last 6 hours
            CASE 
              WHEN EXISTS(
                SELECT 1 FROM notifications n 
                WHERE n.user_id = t.user_id 
                AND n.category = 'task' 
                AND n.title = 'Task overdue'
                AND n.payload->>'task_id' = t.id::text
                AND n.created_at > now() - INTERVAL '6 hours'
              ) THEN true
              ELSE false
            END as notification_sent_recently
          FROM tasks t
          WHERE t.due_date IS NOT NULL 
          AND t.status = 'active'
          AND t.due_date < now_ts
        LOOP
          -- Skip if notification was sent recently (within 6 hours)
          IF task_record.notification_sent_recently THEN
            CONTINUE;
          END IF;
          
          -- Calculate hours overdue
          hours_overdue := EXTRACT(EPOCH FROM (now_ts - task_record.due_date)) / 3600.0;
          
          -- Send notification for overdue tasks
          title_text := 'Task overdue';
          message_text := format('"%s" is overdue by %s hours (was due on %s)', 
            task_record.title, 
            round(hours_overdue, 1),
            to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH24:MI')
          );
          
          -- Insert notification
          INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
          VALUES (
            task_record.user_id,
            'task',
            'error',
            title_text,
            message_text,
            jsonb_build_object(
              'task_id', task_record.id, 
              'group_id', task_record.group_id, 
              'due_date', task_record.due_date, 
              'action_url', '/productivity/task-activity',
              'hours_overdue', round(hours_overdue, 1)
            ),
            now_ts
          );
          
          notifications_sent := notifications_sent + 1;
        END LOOP;
        
        RETURN notifications_sent;
      END;
      $$;

      -- Main function to check all task notifications
      CREATE OR REPLACE FUNCTION check_all_task_notifications()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
        total_notifications INTEGER := 0;
      BEGIN
        -- Check for tasks due soon
        total_notifications := total_notifications + check_task_due_notifications();
        
        -- Check for overdue tasks
        total_notifications := total_notifications + check_overdue_task_notifications();
        
        RETURN total_notifications;
      END;
      $$;

      -- Add comments for documentation
      COMMENT ON FUNCTION check_task_due_notifications() IS 'Checks for tasks due within 24 hours and sends notifications (prevents duplicates within 12 hours)';
      COMMENT ON FUNCTION check_overdue_task_notifications() IS 'Checks for overdue tasks and sends notifications (prevents duplicates within 6 hours)';
      COMMENT ON FUNCTION check_all_task_notifications() IS 'Main function to check all task notifications (due soon + overdue)';
    `;
    
    await pool.query(migrationSQL);
    console.log('   ✅ Applied task due notification scheduler migration');
    
    // 2. Test the functions
    console.log('\n2️⃣ Testing the new functions...');
    
    // Test check_task_due_notifications
    try {
      const result1 = await pool.query('SELECT check_task_due_notifications()');
      console.log(`   ✅ check_task_due_notifications() returned: ${result1.rows[0].check_task_due_notifications}`);
    } catch (error) {
      console.log(`   ⚠️  check_task_due_notifications() test failed: ${error.message}`);
    }
    
    // Test check_overdue_task_notifications
    try {
      const result2 = await pool.query('SELECT check_overdue_task_notifications()');
      console.log(`   ✅ check_overdue_task_notifications() returned: ${result2.rows[0].check_overdue_task_notifications}`);
    } catch (error) {
      console.log(`   ⚠️  check_overdue_task_notifications() test failed: ${error.message}`);
    }
    
    // Test check_all_task_notifications
    try {
      const result3 = await pool.query('SELECT check_all_task_notifications()');
      console.log(`   ✅ check_all_task_notifications() returned: ${result3.rows[0].check_all_task_notifications}`);
    } catch (error) {
      console.log(`   ⚠️  check_all_task_notifications() test failed: ${error.message}`);
    }
    
    // 3. Update the existing check_break_reminders function to also check task notifications
    console.log('\n3️⃣ Updating check_break_reminders to include task notifications...');
    
    const updateBreakRemindersSQL = `
      CREATE OR REPLACE FUNCTION check_break_reminders()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          agent_record RECORD;
          notifications_sent INTEGER := 0;
          check_time TIMESTAMP;
          current_hour INTEGER;
      BEGIN
          -- Get current Manila time
          check_time := NOW() AT TIME ZONE 'Asia/Manila';
          current_hour := EXTRACT(HOUR FROM check_time);
          
          -- Check for task notifications (every time, regardless of hour)
          notifications_sent := notifications_sent + check_all_task_notifications();
          
          -- Only check break reminders during work hours (6 AM - 6 PM)
          IF current_hour < 6 OR current_hour >= 18 THEN
              RETURN notifications_sent; -- Return task notifications only
          END IF;
          
          -- Loop through all agent users
          FOR agent_record IN SELECT DISTINCT u.id as user_id FROM users u WHERE u.user_type = 'Agent' LOOP
              
              -- DAY SHIFT BREAKS (6 AM - 6 PM)
              IF current_hour >= 6 AND current_hour < 18 THEN
                  
                  -- Morning break (8:00 AM)
                  IF current_hour = 7 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'Morning'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Morning'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 8 AND EXTRACT(MINUTE FROM check_time) < 60 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'Morning'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Lunch break (10:30 AM)
                  IF current_hour = 10 AND EXTRACT(MINUTE FROM check_time) >= 15 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'Lunch'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Lunch'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 10 AND EXTRACT(MINUTE FROM check_time) >= 30 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'Lunch'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Afternoon break (2:00 PM)
                  IF current_hour = 13 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'Afternoon'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Afternoon'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 14 AND EXTRACT(MINUTE FROM check_time) < 60 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'Afternoon'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Check for missed breaks (every 30 minutes during work hours)
                  IF EXTRACT(MINUTE FROM check_time) IN (0, 30) THEN
                      -- Morning break missed (after 9:00 AM)
                      IF current_hour >= 9 AND current_hour < 11 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                      
                      -- Lunch break missed (after 12:00 PM)
                      IF current_hour >= 12 AND current_hour < 14 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                      
                      -- Afternoon break missed (after 3:00 PM)
                      IF current_hour >= 15 AND current_hour < 18 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
              -- NIGHT SHIFT BREAKS (6 PM - 6 AM)
              ELSE
                  
                  -- NightFirst break (8:00 PM)
                  IF current_hour = 19 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'NightFirst'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightFirst'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 20 AND EXTRACT(MINUTE FROM check_time) < 60 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'NightFirst'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightMeal break (2:30 AM)
                  IF current_hour = 2 AND EXTRACT(MINUTE FROM check_time) >= 15 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'NightMeal'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightMeal'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 2 AND EXTRACT(MINUTE FROM check_time) >= 30 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'NightMeal'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightSecond break (6:00 AM)
                  IF current_hour = 5 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      -- Available soon (15 min before)
                      IF is_break_available_soon(agent_record.user_id, 'NightSecond'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightSecond'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  IF current_hour = 6 AND EXTRACT(MINUTE FROM check_time) < 60 THEN
                      -- Available now
                      IF is_break_available_now(agent_record.user_id, 'NightSecond'::break_type_enum, check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Check for missed breaks (every 30 minutes during night hours)
                  IF EXTRACT(MINUTE FROM check_time) IN (0, 30) THEN
                      -- NightFirst break missed (after 9:00 PM)
                      IF current_hour >= 21 OR current_hour < 1 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                      
                      -- NightMeal break missed (after 3:00 AM)
                      IF current_hour >= 3 AND current_hour < 5 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                      
                      -- NightSecond break missed (after 7:00 AM)
                      IF current_hour >= 7 AND current_hour < 9 THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond'::break_type_enum);
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
              END IF;
              
              -- Check for breaks ending soon (for all break types)
              IF is_break_ending_soon(agent_record.user_id, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
                  notifications_sent := notifications_sent + 1;
              END IF;
              
          END LOOP;
          
          RETURN notifications_sent;
      END;
      $$;
    `;
    
    await pool.query(updateBreakRemindersSQL);
    console.log('   ✅ Updated check_break_reminders to include task notifications');
    
    // 4. Test the updated function
    console.log('\n4️⃣ Testing the updated check_break_reminders function...');
    
    try {
      const result4 = await pool.query('SELECT check_break_reminders()');
      console.log(`   ✅ check_break_reminders() returned: ${result4.rows[0].check_break_reminders}`);
    } catch (error) {
      console.log(`   ⚠️  check_break_reminders() test failed: ${error.message}`);
    }
    
    console.log('\n🎉 Task Due Notification Scheduler successfully applied!');
    console.log('\n📋 What this adds:');
    console.log('   • check_task_due_notifications() - Monitors tasks due within 24 hours');
    console.log('   • check_overdue_task_notifications() - Monitors overdue tasks');
    console.log('   • check_all_task_notifications() - Main function for both');
    console.log('   • Updated check_break_reminders() - Now includes task notifications');
    console.log('\n⏰ The scheduler will now:');
    console.log('   • Check for tasks due soon every time check_break_reminders() runs');
    console.log('   • Send notifications for tasks approaching their due dates');
    console.log('   • Send notifications for overdue tasks');
    console.log('   • Prevent duplicate notifications (12h for due soon, 6h for overdue)');
    
  } catch (error) {
    console.error('❌ Error applying task due notification scheduler:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  applyTaskDueNotificationScheduler()
    .then(() => {
      console.log('\n✅ Task due notification scheduler setup complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { applyTaskDueNotificationScheduler };
