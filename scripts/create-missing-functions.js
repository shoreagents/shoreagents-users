const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createMissingFunctions() {
  console.log('🔧 Creating Missing Break Notification Functions\n');
  
  try {
    // Create is_break_available_soon function
    console.log('1️⃣ Creating is_break_available_soon function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_available_soon(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          current_hour INTEGER;
      BEGIN
          -- Convert current time to Manila timezone consistently
          current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          current_hour := EXTRACT(HOUR FROM current_time_only);
          
          -- CRITICAL FIX: Add time-of-day validation
          -- For day shifts: 6 AM - 6 PM
          -- For night shifts: 6 PM - 6 AM
          IF p_break_type IN ('Morning', 'Lunch', 'Afternoon') THEN
              -- Day shift breaks
              IF current_hour < 6 OR current_hour >= 18 THEN
                  RETURN FALSE;
              END IF;
          ELSE
              -- Night shift breaks
              IF current_hour >= 6 AND current_hour < 18 THEN
                  RETURN FALSE;
              END IF;
          END IF;
          
          -- Get break start time based on break type
          CASE p_break_type
              WHEN 'Morning' THEN
                  break_start_time := '08:00:00'::TIME;
              WHEN 'Lunch' THEN
                  break_start_time := '10:30:00'::TIME;
              WHEN 'Afternoon' THEN
                  break_start_time := '14:00:00'::TIME;
              WHEN 'NightFirst' THEN
                  break_start_time := '20:00:00'::TIME;
              WHEN 'NightMeal' THEN
                  break_start_time := '02:30:00'::TIME;
              WHEN 'NightSecond' THEN
                  break_start_time := '06:00:00'::TIME;
              ELSE
                  RETURN FALSE;
          END CASE;
          
          -- Calculate minutes until break starts
          minutes_until_break := EXTRACT(EPOCH FROM (break_start_time - current_time_only)) / 60;
          
          -- Handle day rollover for night shifts
          IF minutes_until_break < -720 THEN -- More than 12 hours in the past
              minutes_until_break := minutes_until_break + 1440; -- Add 24 hours
          END IF;
          
          -- Return true if break starts within the next 15 minutes
          RETURN minutes_until_break > 0 AND minutes_until_break <= 15;
      END;
      $$;
    `);
    console.log('   ✅ Created is_break_available_soon function');
    
    // Create create_break_reminder_notification function
    console.log('\n2️⃣ Creating create_break_reminder_notification function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION create_break_reminder_notification(
          p_agent_user_id INTEGER,
          p_notification_type TEXT,
          p_break_type break_type_enum DEFAULT NULL
      )
      RETURNS VOID
      LANGUAGE plpgsql
      AS $$
      DECLARE
          notif_category TEXT := 'break';
          notif_type TEXT := 'info';
          title_text TEXT;
          message_text TEXT;
          payload_data JSONB;
          break_name TEXT;
          current_time_manila TIMESTAMP;
          current_hour INTEGER;
      BEGIN
          -- Get current Manila time
          current_time_manila := NOW() AT TIME ZONE 'Asia/Manila';
          current_hour := EXTRACT(HOUR FROM current_time_manila);
          
          -- CRITICAL FIX: Add time-of-day validation
          IF p_break_type IN ('Morning', 'Lunch', 'Afternoon') THEN
              -- Day shift breaks: 6 AM - 6 PM
              IF current_hour < 6 OR current_hour >= 18 THEN
                  RETURN; -- Don't create notifications outside day shift hours
              END IF;
          ELSE
              -- Night shift breaks: 6 PM - 6 AM
              IF current_hour >= 6 AND current_hour < 18 THEN
                  RETURN; -- Don't create notifications outside night shift hours
              END IF;
          END IF;
          
          -- Determine break name for display
          break_name := CASE p_break_type
              WHEN 'Morning' THEN 'Morning break'
              WHEN 'Lunch' THEN 'Lunch break'
              WHEN 'Afternoon' THEN 'Afternoon break'
              WHEN 'NightFirst' THEN 'First night break'
              WHEN 'NightMeal' THEN 'Night meal break'
              WHEN 'NightSecond' THEN 'Second night break'
              ELSE 'Break'
          END;
          
          -- Set notification content based on type
          IF p_notification_type = 'available_soon' THEN
              title_text := format('%s available soon', break_name);
              message_text := format('Your %s will be available in 15 minutes', break_name);
              notif_type := 'info';
              payload_data := jsonb_build_object(
                  'reminder_type', 'available_soon',
                  'break_type', p_break_type,
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'available_now' THEN
              title_text := format('%s is now available', break_name);
              message_text := format('Your %s is now available! You can take it now.', break_name);
              notif_type := 'success';
              payload_data := jsonb_build_object(
                  'reminder_type', 'available_now',
                  'break_type', p_break_type,
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'ending_soon' THEN
              title_text := 'Break ending soon';
              message_text := 'Your current break will end in 5 minutes';
              notif_type := 'warning';
              payload_data := jsonb_build_object(
                  'reminder_type', 'ending_soon',
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'missed_break' THEN
              title_text := format('You have not taken your %s yet!', break_name);
              message_text := format('Your %s was available but you haven\'t taken it yet. Please take your break soon.', break_name);
              notif_type := 'warning';
              payload_data := jsonb_build_object(
                  'reminder_type', 'missed_break',
                  'break_type', p_break_type,
                  'action_url', '/status/breaks'
              );
          ELSE
              RETURN; -- Invalid notification type
          END IF;
          
          -- Check if similar notification already exists in the last 60 minutes
          -- This prevents spam and duplicate notifications
          IF EXISTS(
              SELECT 1 FROM notifications 
              WHERE user_id = p_agent_user_id 
              AND category = notif_category
              AND title = title_text
              AND created_at > (NOW() - INTERVAL '60 minutes')
          ) THEN
              RETURN; -- Don't create duplicate notifications
          END IF;
          
          -- Insert the notification
          INSERT INTO notifications (user_id, category, type, title, message, payload)
          VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data);
      END;
      $$;
    `);
    console.log('   ✅ Created create_break_reminder_notification function');
    
    // Update check_break_reminders to use the new functions
    console.log('\n3️⃣ Updating check_break_reminders function...');
    await pool.query(`
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
          -- Use Manila timezone consistently
          check_time := NOW() AT TIME ZONE 'Asia/Manila';
          current_hour := EXTRACT(HOUR FROM check_time);
          
          -- Loop through all active agents
          FOR agent_record IN 
              SELECT DISTINCT u.id as user_id
              FROM users u
              WHERE u.user_type = 'Agent'
          LOOP
              -- Check for day shift breaks (6 AM - 6 PM)
              IF current_hour >= 6 AND current_hour < 18 THEN
                  -- Morning break available soon (7:45 AM - 8:00 AM)
                  IF current_hour = 7 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      IF is_break_available_soon(agent_record.user_id, 'Morning', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Morning');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Morning break available now (8:00 AM - 10:00 AM)
                  IF current_hour >= 8 AND current_hour < 10 THEN
                      IF is_break_available_now(agent_record.user_id, 'Morning', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Morning');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Lunch break available soon (10:15 AM - 10:30 AM)
                  IF current_hour = 10 AND EXTRACT(MINUTE FROM check_time) >= 15 THEN
                      IF is_break_available_soon(agent_record.user_id, 'Lunch', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Lunch');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Lunch break available now (10:30 AM - 11:30 AM)
                  IF current_hour = 10 AND EXTRACT(MINUTE FROM check_time) >= 30 THEN
                      IF is_break_available_now(agent_record.user_id, 'Lunch', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Lunch');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Afternoon break available soon (1:45 PM - 2:00 PM)
                  IF current_hour = 13 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      IF is_break_available_soon(agent_record.user_id, 'Afternoon', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'Afternoon');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Afternoon break available now (2:00 PM - 4:00 PM)
                  IF current_hour >= 14 AND current_hour < 16 THEN
                      IF is_break_available_now(agent_record.user_id, 'Afternoon', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'Afternoon');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Check for missed breaks (every 30 minutes)
                  IF EXTRACT(MINUTE FROM check_time) % 30 = 0 THEN
                      -- Morning break missed (after 10:00 AM)
                      IF current_hour >= 10 AND current_hour < 12 THEN
                          IF is_break_missed(agent_record.user_id, 'Morning', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Morning');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                      
                      -- Lunch break missed (after 11:30 AM)
                      IF current_hour >= 12 AND current_hour < 14 THEN
                          IF is_break_missed(agent_record.user_id, 'Lunch', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Lunch');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                      
                      -- Afternoon break missed (after 4:00 PM)
                      IF current_hour >= 16 AND current_hour < 18 THEN
                          IF is_break_missed(agent_record.user_id, 'Afternoon', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'Afternoon');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                  END IF;
              END IF;
              
              -- Check for night shift breaks (6 PM - 6 AM)
              IF current_hour >= 18 OR current_hour < 6 THEN
                  -- NightFirst break available soon (7:45 PM - 8:00 PM)
                  IF current_hour = 19 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      IF is_break_available_soon(agent_record.user_id, 'NightFirst', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightFirst');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightFirst break available now (8:00 PM - 10:00 PM)
                  IF current_hour >= 20 AND current_hour < 22 THEN
                      IF is_break_available_now(agent_record.user_id, 'NightFirst', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightFirst');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightMeal break available soon (2:15 AM - 2:30 AM)
                  IF current_hour = 2 AND EXTRACT(MINUTE FROM check_time) >= 15 THEN
                      IF is_break_available_soon(agent_record.user_id, 'NightMeal', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightMeal');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightMeal break available now (2:30 AM - 3:30 AM)
                  IF current_hour = 2 AND EXTRACT(MINUTE FROM check_time) >= 30 THEN
                      IF is_break_available_now(agent_record.user_id, 'NightMeal', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightMeal');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightSecond break available soon (5:45 AM - 6:00 AM)
                  IF current_hour = 5 AND EXTRACT(MINUTE FROM check_time) >= 45 THEN
                      IF is_break_available_soon(agent_record.user_id, 'NightSecond', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', 'NightSecond');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- NightSecond break available now (6:00 AM - 8:00 AM)
                  IF current_hour >= 6 AND current_hour < 8 THEN
                      IF is_break_available_now(agent_record.user_id, 'NightSecond', check_time) THEN
                          PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', 'NightSecond');
                          notifications_sent := notifications_sent + 1;
                      END IF;
                  END IF;
                  
                  -- Check for missed night breaks (every 30 minutes)
                  IF EXTRACT(MINUTE FROM check_time) % 30 = 0 THEN
                      -- NightFirst break missed (after 10:00 PM)
                      IF current_hour >= 22 OR current_hour < 2 THEN
                          IF is_break_missed(agent_record.user_id, 'NightFirst', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightFirst');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                      
                      -- NightMeal break missed (after 3:30 AM)
                      IF current_hour >= 4 AND current_hour < 6 THEN
                          IF is_break_missed(agent_record.user_id, 'NightMeal', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightMeal');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                      
                      -- NightSecond break missed (after 8:00 AM)
                      IF current_hour >= 8 AND current_hour < 10 THEN
                          IF is_break_missed(agent_record.user_id, 'NightSecond', check_time) THEN
                              PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', 'NightSecond');
                              notifications_sent := notifications_sent + 1;
                          END IF;
                      END IF;
                  END IF;
              END IF;
              
              -- Check for breaks ending soon
              IF is_break_ending_soon(agent_record.user_id, check_time) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
                  notifications_sent := notifications_sent + 1;
              END IF;
          END LOOP;
          
          RETURN notifications_sent;
      END;
      $$;
    `);
    console.log('   ✅ Updated check_break_reminders function');
    
    // Test the new functions
    console.log('\n4️⃣ Testing the new functions...');
    
    try {
      const testAvailableSoon = await pool.query(`SELECT is_break_available_soon(2, 'Lunch'::break_type_enum)`);
      console.log(`   ✅ is_break_available_soon(2, 'Lunch') works: ${testAvailableSoon.rows[0].is_break_available_soon}`);
    } catch (error) {
      console.log(`   ❌ is_break_available_soon error: ${error.message}`);
    }
    
    try {
      const testCreateNotif = await pool.query(`SELECT create_break_reminder_notification(2, 'available_soon', 'Lunch'::break_type_enum)`);
      console.log(`   ✅ create_break_reminder_notification works`);
    } catch (error) {
      console.log(`   ❌ create_break_reminder_notification error: ${error.message}`);
    }
    
    try {
      const testScheduler = await pool.query(`SELECT check_break_reminders()`);
      console.log(`   ✅ check_break_reminders() works: ${testScheduler.rows[0].check_break_reminders} notifications sent`);
    } catch (error) {
      console.log(`   ❌ check_break_reminders error: ${error.message}`);
    }
    
    console.log('\n🎉 All missing functions created successfully!');
    console.log('   ✅ is_break_available_soon: Created');
    console.log('   ✅ create_break_reminder_notification: Created');
    console.log('   ✅ check_break_reminders: Updated with comprehensive logic');
    
    console.log('\n🎯 Now the system supports:');
    console.log('   • Available soon notifications (15 min before)');
    console.log('   • Available now notifications');
    console.log('   • Missed break reminders (every 30 min)');
    console.log('   • Ending soon notifications');
    console.log('   • Proper day/night shift handling');
    console.log('   • Timezone-aware scheduling');
    
  } catch (error) {
    console.error('❌ Error creating functions:', error.message);
  } finally {
    await pool.end();
  }
}

createMissingFunctions();
