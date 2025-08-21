const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixDynamicShiftLogic() {
  console.log('🔧 Fixing Break Notification Functions to Use Dynamic Shift Times\n');
  
  try {
    // 1. Fix is_break_available_soon to use actual shift times
    console.log('1️⃣ Fixing is_break_available_soon function...');
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
          shift_info RECORD;
          current_time_manila TIMESTAMP;
          current_time_only TIME;
          break_start_time TIME;
          minutes_until_break INTEGER;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
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
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 2), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get current Manila time
          current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          -- Check if current time is within the agent's shift window
          IF is_night_shift THEN
              -- Night shift: current time should be after start OR before end
              IF current_time_only < shift_start_time AND current_time_only > shift_end_time THEN
                  RETURN FALSE; -- Outside shift hours
              END IF;
          ELSE
              -- Day shift: current time should be between start and end
              IF current_time_only < shift_start_time OR current_time_only > shift_end_time THEN
                  RETURN FALSE; -- Outside shift hours
              END IF;
          END IF;
          
          -- Calculate break start time based on break type and shift start
          CASE p_break_type
              WHEN 'Morning' THEN
                  break_start_time := shift_start_time + INTERVAL '2 hours';
              WHEN 'Lunch' THEN
                  break_start_time := shift_start_time + INTERVAL '4 hours';
              WHEN 'Afternoon' THEN
                  break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
              WHEN 'NightFirst' THEN
                  break_start_time := shift_start_time + INTERVAL '2 hours';
              WHEN 'NightMeal' THEN
                  break_start_time := shift_start_time + INTERVAL '4 hours';
              WHEN 'NightSecond' THEN
                  break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
              ELSE
                  RETURN FALSE;
          END CASE;
          
          -- Handle day rollover for night shifts
          IF is_night_shift AND break_start_time < shift_start_time THEN
              break_start_time := break_start_time + INTERVAL '24 hours';
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
    
    // 2. Fix create_break_reminder_notification to use actual shift times
    console.log('\n2️⃣ Fixing create_break_reminder_notification function...');
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
          shift_info RECORD;
          notif_category TEXT := 'break';
          notif_type TEXT := 'info';
          title_text TEXT;
          message_text TEXT;
          payload_data JSONB;
          break_name TEXT;
          current_time_manila TIMESTAMP;
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
          current_time_only TIME;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN; -- No shift configured
          END IF;
          
          -- Parse shift time
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
              WHEN split_part(shift_info.shift_time, ' - ', 2) LIKE '12:%AM' THEN
                  replace(split_part(shift_info.shift_time, ' - ', 2), '12:', '00:')::TIME
              ELSE
                  split_part(split_part(shift_info.shift_time, ' - ', 2), ' ', 1)::TIME
          END;
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get current Manila time
          current_time_manila := NOW() AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          -- Check if current time is within the agent's shift window
          IF is_night_shift THEN
              -- Night shift: current time should be after start OR before end
              IF current_time_only < shift_start_time AND current_time_only > shift_end_time THEN
                  RETURN; -- Outside shift hours
              END IF;
          ELSE
              -- Day shift: current time should be between start and end
              IF current_time_only < shift_start_time OR current_time_only > shift_end_time THEN
                  RETURN; -- Outside shift hours
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
              message_text := 'Your current break will end in 5 minutes';
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
    console.log('   ✅ Fixed create_break_reminder_notification function');
    
    // 3. Fix is_break_available_now to use actual shift times
    console.log('\n3️⃣ Fixing is_break_available_now function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_available_now(
          p_agent_user_id INTEGER,
          p_break_type break_type_enum,
          p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
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
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- Parse shift time
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
          
          -- Determine if it's a night shift
          is_night_shift := shift_start_time > shift_end_time;
          
          -- Get current Manila time
          current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
          -- Check if current time is within the agent's shift window
          IF is_night_shift THEN
              -- Night shift: current time should be after start OR before end
              IF current_time_only < shift_start_time AND current_time_only > shift_end_time THEN
                  RETURN FALSE; -- Outside shift hours
              END IF;
          ELSE
              -- Day shift: current time should be between start and end
              IF current_time_only < shift_start_time OR current_time_only > shift_end_time THEN
                  RETURN FALSE; -- Outside shift hours
              END IF;
          END IF;
          
          -- Calculate break start and end times based on shift start
          CASE p_break_type
              WHEN 'Morning' THEN
                  break_start_time := shift_start_time + INTERVAL '2 hours';
                  break_end_time := shift_start_time + INTERVAL '3 hours';
              WHEN 'Lunch' THEN
                  break_start_time := shift_start_time + INTERVAL '4 hours';
                  break_end_time := shift_start_time + INTERVAL '7 hours';
              WHEN 'Afternoon' THEN
                  break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
                  break_end_time := shift_start_time + INTERVAL '8 hours 45 minutes';
              WHEN 'NightFirst' THEN
                  break_start_time := shift_start_time + INTERVAL '2 hours';
                  break_end_time := shift_start_time + INTERVAL '3 hours';
              WHEN 'NightMeal' THEN
                  break_start_time := shift_start_time + INTERVAL '4 hours';
                  break_end_time := shift_start_time + INTERVAL '7 hours';
              WHEN 'NightSecond' THEN
                  break_start_time := shift_start_time + INTERVAL '7 hours 45 minutes';
                  break_end_time := shift_start_time + INTERVAL '8 hours 45 minutes';
              ELSE
                  RETURN FALSE;
          END CASE;
          
          -- Handle day rollover for night shifts
          IF is_night_shift THEN
              IF break_start_time < shift_start_time THEN
                  break_start_time := break_start_time + INTERVAL '24 hours';
                  break_end_time := break_end_time + INTERVAL '24 hours';
              END IF;
          END IF;
          
          -- Check if current time is within the break window
          RETURN current_time_only >= break_start_time AND current_time_only <= break_end_time;
      END;
      $$;
    `);
    console.log('   ✅ Fixed is_break_available_now function');
    
    // Test the fixed functions
    console.log('\n4️⃣ Testing the fixed functions...');
    
    try {
      // Test User 2 (Day Shift: 7 AM - 4 PM)
      console.log('\n   🌞 Testing User 2 (Day Shift: 7 AM - 4 PM):');
      const user2AvailableSoon = await pool.query(`SELECT is_break_available_soon(2, 'Lunch'::break_type_enum)`);
      console.log(`     • Lunch available soon: ${user2AvailableSoon.rows[0].is_break_available_soon}`);
      
      const user2AvailableNow = await pool.query(`SELECT is_break_available_now(2, 'Lunch'::break_type_enum)`);
      console.log(`     • Lunch available now: ${user2AvailableNow.rows[0].is_break_available_now}`);
      
      // Test User 4 (Night Shift: 10 PM - 7 AM)
      console.log('\n   🌙 Testing User 4 (Night Shift: 10 PM - 7 AM):');
      const user4AvailableSoon = await pool.query(`SELECT is_break_available_soon(4, 'NightFirst'::break_type_enum)`);
      console.log(`     • NightFirst available soon: ${user4AvailableSoon.rows[0].is_break_available_soon}`);
      
      const user4AvailableNow = await pool.query(`SELECT is_break_available_now(4, 'NightFirst'::break_type_enum)`);
      console.log(`     • NightFirst available now: ${user4AvailableNow.rows[0].is_break_available_now}`);
      
    } catch (error) {
      console.log(`   ❌ Error testing functions: ${error.message}`);
    }
    
    console.log('\n🎉 Break notification functions fixed successfully!');
    console.log('\n🎯 Now supports DYNAMIC shift times:');
    console.log('   • User 2: 7:00 AM - 4:00 PM (Day Shift)');
    console.log('   • User 4: 10:00 PM - 7:00 AM (Night Shift)');
    console.log('   • Break times calculated relative to actual shift start');
    console.log('   • No more hardcoded 6 AM - 6 PM logic!');
    
  } catch (error) {
    console.error('❌ Error fixing functions:', error.message);
  } finally {
    await pool.end();
  }
}

fixDynamicShiftLogic();
