const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateCheckBreakReminders() {
  console.log('🔧 Updating check_break_reminders Function\n');
  
  try {
    console.log('1️⃣ Updating check_break_reminders function...');
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
          -- Get current Manila time
          check_time := NOW() AT TIME ZONE 'Asia/Manila';
          current_hour := EXTRACT(HOUR FROM check_time);
          
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
    `);
    console.log('   ✅ Updated check_break_reminders function');
    
    // Test the updated function
    console.log('\n2️⃣ Testing the updated check_break_reminders function...');
    
    try {
      const testResult = await pool.query(`SELECT check_break_reminders()`);
      console.log(`   ✅ check_break_reminders() works: ${testResult.rows[0].check_break_reminders} notifications sent`);
    } catch (error) {
      console.log(`   ❌ check_break_reminders error: ${error.message}`);
    }
    
    console.log('\n🎉 check_break_reminders function updated successfully!');
    console.log('\n🎯 Now supports ALL notification types:');
    console.log('   • Available soon (15 min before break)');
    console.log('   • Available now (when break starts)');
    console.log('   • Missed break (every 30 min during work hours)');
    console.log('   • Ending soon (5 min before break ends)');
    console.log('\n🕐 Shift-based logic:');
    console.log('   • Day shift (6 AM - 6 PM): Morning, Lunch, Afternoon breaks');
    console.log('   • Night shift (6 PM - 6 AM): NightFirst, NightMeal, NightSecond breaks');
    
  } catch (error) {
    console.error('❌ Error updating function:', error.message);
  } finally {
    await pool.end();
  }
}

updateCheckBreakReminders();
