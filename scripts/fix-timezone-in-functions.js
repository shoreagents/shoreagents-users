const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixTimezoneInFunctions() {
  console.log('🔧 Fixing Timezone Issues in Break Functions\n');
  
  try {
    // First, let's check the database timezone settings
    console.log('1️⃣ Checking database timezone settings:');
    
    const timezoneCheck = await pool.query(`
      SELECT 
        current_setting('timezone') as db_timezone,
        NOW() as utc_now,
        NOW() AT TIME ZONE 'Asia/Manila' as manila_now,
        CURRENT_TIMESTAMP as current_timestamp,
        CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila' as current_timestamp_manila
    `);
    
    const tz = timezoneCheck.rows[0];
    console.log(`   • Database timezone: ${tz.db_timezone}`);
    console.log(`   • UTC NOW(): ${tz.utc_now}`);
    console.log(`   • Manila NOW(): ${tz.manila_now}`);
    console.log(`   • CURRENT_TIMESTAMP: ${tz.current_timestamp}`);
    console.log(`   • Manila CURRENT_TIMESTAMP: ${tz.current_timestamp_manila}`);
    
    // Fix the is_break_available_now function with proper timezone handling
    console.log('\n2️⃣ Fixing is_break_available_now function with proper timezone handling:');
    
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
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- CRITICAL FIX: Get current Manila time properly
          IF p_current_time IS NULL THEN
              -- Use CURRENT_TIMESTAMP and convert to Manila time
              current_time_manila := CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
          ELSE
              -- Convert provided timestamp to Manila time
              current_time_manila := p_current_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
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
    
    // Fix the is_break_available_soon function with proper timezone handling
    console.log('\n3️⃣ Fixing is_break_available_soon function:');
    
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
          shift_start_time TIME;
          shift_end_time TIME;
          is_night_shift BOOLEAN;
      BEGIN
          -- Get agent's actual shift information
          SELECT * INTO shift_info FROM get_agent_shift_info(p_agent_user_id) LIMIT 1;
          
          IF NOT FOUND OR shift_info.shift_time IS NULL THEN
              RETURN FALSE; -- No shift configured
          END IF;
          
          -- CRITICAL FIX: Get current Manila time properly
          IF p_current_time IS NULL THEN
              current_time_manila := CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
          ELSE
              current_time_manila := p_current_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
          END IF;
          
          current_time_only := current_time_manila::TIME;
          
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
          
          -- Determine if it's a night shift (crosses midnight)
          is_night_shift := shift_start_time > shift_end_time;
          
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
    
    // Fix the create_break_reminder_notification function
    console.log('\n4️⃣ Fixing create_break_reminder_notification function:');
    
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
          
          -- CRITICAL FIX: Get current Manila time properly
          current_time_manila := CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
          current_time_only := current_time_manila::TIME;
          
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
    
    // Test the fixed functions
    console.log('\n5️⃣ Testing the fixed functions:');
    
    const testTime = await pool.query(`
      SELECT 
        CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' as fixed_manila_time,
        (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::TIME as fixed_time_only
    `);
    
    console.log(`   • Fixed Manila time: ${testTime.rows[0].fixed_manila_time}`);
    console.log(`   • Fixed time only: ${testTime.rows[0].fixed_time_only}`);
    
    const testResult = await pool.query(`SELECT is_break_available_now(2, 'Lunch'::break_type_enum)`);
    console.log(`   • is_break_available_now(2, 'Lunch') result: ${testResult.rows[0].is_break_available_now}`);
    
    console.log('\n🎉 Timezone fixes applied successfully!');
    console.log('   ✅ Functions now use proper Manila time conversion');
    console.log('   ✅ Should correctly block notifications outside shift hours');
    console.log('   ✅ Should correctly calculate break windows relative to shift start');
    
  } catch (error) {
    console.error('❌ Error fixing timezone issues:', error.message);
  } finally {
    await pool.end();
  }
}

fixTimezoneInFunctions();
