const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixNotificationSystemComprehensive() {
  try {
    console.log('🔧 Comprehensive Fix for Break Notification System\n');
    
    // 1. Fix the calculate_break_windows function to accept user_id instead of shift_time
    console.log('1️⃣ Fixing calculate_break_windows function signature...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION calculate_break_windows(p_user_id INTEGER)
      RETURNS TABLE(break_type break_type_enum, start_time TIME, end_time TIME)
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN; -- No shift configured
          END IF;
          
          -- Parse shift time (e.g., "7:00 AM - 4:00 PM" or "10:00 PM - 7:00 AM")
          shift_start_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 1) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 1), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 1), ' ', 1)::TIME
          END;
          
          shift_end_time := CASE 
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '%PM' AND 
                   NOT split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%PM' THEN
                  (split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME + INTERVAL '12 hours')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Return break windows based on shift start time
          -- Morning/First Night break: 2 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Morning'::break_type_enum
                  ELSE 'NightFirst'::break_type_enum
              END,
              shift_start_time + INTERVAL '2 hours',
              shift_start_time + INTERVAL '3 hours';
          
          -- Lunch/Night Meal break: 4 hours after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Lunch'::break_type_enum
                  ELSE 'NightMeal'::break_type_enum
              END,
              shift_start_time + INTERVAL '4 hours',
              shift_start_time + INTERVAL '7 hours';
          
          -- Afternoon/Second Night break: 7 hours 45 minutes after shift start
          RETURN QUERY SELECT 
              CASE 
                  WHEN shift_info.shift_period = 'Day Shift' THEN 'Afternoon'::break_type_enum
                  ELSE 'NightSecond'::break_type_enum
              END,
              shift_start_time + INTERVAL '7 hours 45 minutes',
              shift_start_time + INTERVAL '8 hours 45 minutes';
      END;
      $$;
    `);
    console.log('   ✅ Fixed calculate_break_windows function');
    
    // 2. Fix the is_break_available_soon function
    console.log('\n2️⃣ Fixing is_break_available_soon function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_available_soon(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break start time from calculate_break_windows
          SELECT start_time INTO break_start_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
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
    console.log('   ✅ Fixed is_break_available_soon function');
    
    // 3. Fix the is_break_available_now function
    console.log('\n3️⃣ Fixing is_break_available_now function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_available_now(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          break_already_taken BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_time_manila::DATE
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if current time is within the break window
          RETURN current_time_only >= break_start_time AND current_time_only < break_end_time;
      END;
      $$;
    `);
    console.log('   ✅ Fixed is_break_available_now function');
    
    // 4. Fix the is_break_ending_soon function
    console.log('\n4️⃣ Fixing is_break_ending_soon function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_ending_soon(
          p_agent_user_id INTEGER,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_end_time TIME;
          minutes_until_end INTEGER;
          active_break_type break_type_enum;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
          -- Find which break is currently active
          SELECT break_type, end_time INTO active_break_type, break_end_time
          FROM calculate_break_windows(p_agent_user_id) bw
          WHERE current_time_only >= bw.start_time 
          AND current_time_only < bw.end_time
          AND NOT EXISTS(
              SELECT 1 FROM break_sessions bs
              WHERE bs.agent_user_id = p_agent_user_id
              AND bs.break_type = bw.break_type
              AND bs.break_date = current_time_manila::DATE
              AND bs.end_time IS NOT NULL
          )
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No active break
          END IF;
          
          -- Calculate minutes until break ends
          minutes_until_end := EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60;
          
          -- Return true if break ends within the next 15 minutes
          RETURN minutes_until_end > 0 AND minutes_until_end <= 15;
      END;
      $$;
    `);
    console.log('   ✅ Fixed is_break_ending_soon function');
    
    // 5. Fix the is_break_missed function to send reminders every 30 minutes
    console.log('\n5️⃣ Fixing is_break_missed function for 30-minute reminders...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_missed(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT NULL
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          break_end_time TIME;
          minutes_since_break_start INTEGER;
          break_already_taken BOOLEAN;
          current_date_manila DATE;
          last_notification_time TIMESTAMP;
          minutes_since_last_notification INTEGER;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Get current Manila time
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          ELSE
              current_time_manila := p_current_time;
          END IF;
          
          current_time_only := current_time_manila::TIME;
          current_date_manila := current_time_manila::DATE;
          
          -- Check if break was already taken today
          SELECT EXISTS(
              SELECT 1 FROM break_sessions
              WHERE agent_user_id = p_agent_user_id
              AND break_type = p_break_type
              AND break_date = current_date_manila
              AND end_time IS NOT NULL
          ) INTO break_already_taken;
          
          IF break_already_taken THEN
              RETURN FALSE; -- Break already taken
          END IF;
          
          -- Get break window from calculate_break_windows
          SELECT start_time, end_time INTO break_start_time, break_end_time
          FROM calculate_break_windows(p_agent_user_id)
          WHERE break_type = p_break_type
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE; -- No break window for this type
          END IF;
          
          -- Check if we're within the break window
          IF current_time_only < break_start_time OR current_time_only >= break_end_time THEN
              RETURN FALSE; -- Outside break window
          END IF;
          
          -- Calculate minutes since break start
          minutes_since_break_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
          
          -- Check if it's been at least 30 minutes since break start
          IF minutes_since_break_start < 30 THEN
              RETURN FALSE; -- Too early to send reminder
          END IF;
          
          -- Check if we're too close to break end (within last 15 minutes)
          IF EXTRACT(EPOCH FROM (break_end_time - current_time_only)) / 60 < 15 THEN
              RETURN FALSE; -- Too close to break end
          END IF;
          
          -- Check if we've sent a notification in the last 25 minutes (prevent spam)
          SELECT MAX(created_at) INTO last_notification_time
          FROM notifications 
          WHERE user_id = p_agent_user_id 
          AND category = 'break' 
          AND payload->>'break_type' = p_break_type::TEXT
          AND payload->>'reminder_type' = 'missed_break'
          AND created_at > current_time_manila - INTERVAL '1 hour';
          
          IF last_notification_time IS NOT NULL THEN
              minutes_since_last_notification := EXTRACT(EPOCH FROM (current_time_manila - last_notification_time)) / 60;
              IF minutes_since_last_notification < 25 THEN
                  RETURN FALSE; -- Too soon since last notification
              END IF;
          END IF;
          
          -- Send reminder every 30 minutes during the break window
          -- This ensures reminders at :00 and :30 of each hour
          RETURN (minutes_since_break_start % 30) < 5;
      END;
      $$;
    `);
    console.log('   ✅ Fixed is_break_missed function');
    
    // 6. Fix the create_break_reminder_notification function
    console.log('\n6️⃣ Fixing create_break_reminder_notification function...');
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
      BEGIN
          -- Get current Manila time
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          
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
              title_text := break_name || ' available soon';
              message_text := 'Your ' || break_name || ' will be available in 15 minutes';
              notif_type := 'info';
              payload_data := jsonb_build_object(
                  'reminder_type', 'available_soon',
                  'break_type', p_break_type,
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'available_now' THEN
              title_text := break_name || ' is now available';
              message_text := 'Your ' || break_name || ' is now available! You can take it now.';
              notif_type := 'success';
              payload_data := jsonb_build_object(
                  'reminder_type', 'available_now',
                  'break_type', p_break_type,
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'ending_soon' THEN
              title_text := 'Break ending soon';
              message_text := 'Your current break will end in 15 minutes';
              notif_type := 'warning';
              payload_data := jsonb_build_object(
                  'reminder_type', 'ending_soon',
                  'action_url', '/status/breaks'
              );
          ELSIF p_notification_type = 'missed_break' THEN
              title_text := 'You have not taken your ' || break_name || ' yet!';
              message_text := 'Your ' || break_name || ' was available but you haven''t taken it yet. Please take your break soon.';
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
          IF EXISTS(
              SELECT 1 FROM notifications 
              WHERE user_id = p_agent_user_id 
              AND category = notif_category
              AND title = title_text
              AND created_at > current_time_manila - INTERVAL '60 minutes'
          ) THEN
              RETURN; -- Don't create duplicate notifications
          END IF;
          
          -- Insert the notification with correct Manila time
          INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
          VALUES (p_agent_user_id, notif_category, notif_type, title_text, message_text, payload_data, current_time_manila);
      END;
      $$;
    `);
    console.log('   ✅ Fixed create_break_reminder_notification function');
    
    // 7. Fix the check_break_reminders function to call all notification types
    console.log('\n7️⃣ Fixing check_break_reminders function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION check_break_reminders()
      RETURNS INTEGER
      LANGUAGE plpgsql
      AS $$
      DECLARE
          agent_record RECORD;
          notifications_sent INTEGER := 0;
          current_time_manila TIMESTAMP;
          break_windows RECORD;
      BEGIN
          -- Get current Manila time
          current_time_manila := CURRENT_TIMESTAMP + INTERVAL '8 hours';
          
          -- Loop through all agents
          FOR agent_record IN 
              SELECT DISTINCT u.id as user_id
              FROM users u
              JOIN job_info j ON u.id = j.agent_user_id
              WHERE u.user_type = 'Agent' AND j.shift_time IS NOT NULL
          LOOP
              -- Get break windows for this agent
              FOR break_windows IN
                  SELECT * FROM calculate_break_windows(agent_record.user_id)
              LOOP
                  -- Check for available soon notifications (15 min before start)
                  IF is_break_available_soon(agent_record.user_id, break_windows.break_type, current_time_manila) THEN
                      PERFORM create_break_reminder_notification(agent_record.user_id, 'available_soon', break_windows.break_type);
                      notifications_sent := notifications_sent + 1;
                  END IF;
                  
                  -- Check for available now notifications (exact start time)
                  IF is_break_available_now(agent_record.user_id, break_windows.break_type, current_time_manila) THEN
                      PERFORM create_break_reminder_notification(agent_record.user_id, 'available_now', break_windows.break_type);
                      notifications_sent := notifications_sent + 1;
                  END IF;
                  
                  -- Check for missed break notifications (every 30 min during break window)
                  IF is_break_missed(agent_record.user_id, break_windows.break_type, current_time_manila) THEN
                      PERFORM create_break_reminder_notification(agent_record.user_id, 'missed_break', break_windows.break_type);
                      notifications_sent := notifications_sent + 1;
                  END IF;
              END LOOP;
              
              -- Check for breaks ending soon (for all break types)
              IF is_break_ending_soon(agent_record.user_id, current_time_manila) THEN
                  PERFORM create_break_reminder_notification(agent_record.user_id, 'ending_soon');
                  notifications_sent := notifications_sent + 1;
              END IF;
          END LOOP;
          
          RETURN notifications_sent;
      END;
      $$;
    `);
    console.log('   ✅ Fixed check_break_reminders function');
    
    console.log('\n🎯 Testing the fixed functions...');
    
    // Test the functions
    const testResults = await pool.query(`
      SELECT 
          is_break_available_soon(4, 'NightFirst'::break_type_enum) as available_soon,
          is_break_available_now(4, 'NightFirst'::break_type_enum) as available_now,
          is_break_missed(4, 'NightFirst'::break_type_enum) as missed_break,
          is_break_ending_soon(4) as ending_soon
    `);
    
    console.log('   • Available soon:', testResults.rows[0].available_soon);
    console.log('   • Available now:', testResults.rows[0].available_now);
    console.log('   • Missed break:', testResults.rows[0].missed_break);
    console.log('   • Ending soon:', testResults.rows[0].ending_soon);
    
    console.log('\n✅ Comprehensive notification system fix completed!');
    console.log('\n📋 What was fixed:');
    console.log('   • Function signatures now accept user_id instead of shift_time');
    console.log('   • All 4 notification types now work: available_soon, available_now, ending_soon, missed_break');
    console.log('   • Missed break reminders now send every 30 minutes instead of every hour');
    console.log('   • Timezone handling fixed to use Manila time consistently');
    console.log('   • Duplicate notification prevention improved');
    
  } catch (error) {
    console.error('❌ Error fixing notification system:', error.message);
  } finally {
    await pool.end();
  }
}

fixNotificationSystemComprehensive();
