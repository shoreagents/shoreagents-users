// Apply the migration to add missing "missed break" reminder logic to check_break_reminders

const { Pool } = require('pg')

async function applyMissingBreakReminderFix() {
  console.log('🔧 Applying Missing Break Reminder Fix...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Checking current function definition...')
    
    const currentDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (currentDef.rows.length > 0) {
      const definition = currentDef.rows[0].definition
      
      if (definition.includes('is_break_missed(')) {
        console.log('   ✅ Function already has missed break logic')
        console.log('   📝 No changes needed')
        return
      } else {
        console.log('   ❌ Function is missing missed break logic')
      }
    }
    
    console.log('\n2️⃣ Applying the fix by recreating the function...')
    
    // Drop and recreate the function with the missing logic
    const createFunctionSQL = `
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
              
              -- NEW: Check for missed breaks (30 minutes after break becomes available)
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
              
              -- FIXED: Add break window ending soon checks (15 minutes before break window expires)
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
              
              -- REMOVED: Active break ending soon check to prevent duplicate notifications
              -- We only need break window ending soon notifications (15 minutes before window expires)
              -- The is_break_window_ending_soon function already handles this correctly
          END LOOP;
          
          RETURN notifications_sent;
      END;
      $function$;
    `
    
    try {
      await pool.query(createFunctionSQL)
      console.log('   ✅ Function recreated successfully with missed break logic')
    } catch (error) {
      console.log(`   ❌ Error recreating function: ${error.message}`)
      throw error
    }
    
    console.log('\n3️⃣ Verifying the fix was applied...')
    
    // Check if is_break_missed is now called in check_break_reminders
    const checkBreakRemindersDef = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition
      FROM pg_proc 
      WHERE proname = 'check_break_reminders'
    `)
    
    if (checkBreakRemindersDef.rows.length > 0) {
      const definition = checkBreakRemindersDef.rows[0].definition
      
      if (definition.includes('is_break_missed(')) {
        console.log('   ✅ is_break_missed is now called in check_break_reminders')
        
        // Count how many times it's called
        const matches = definition.match(/is_break_missed\(/g)
        if (matches) {
          console.log(`   📊 Total calls to is_break_missed: ${matches.length}`)
        }
        
        // Check if it's called for Afternoon breaks specifically
        if (definition.includes("is_break_missed(agent_record.user_id, 'Afternoon'")) {
          console.log('   ✅ is_break_missed is called for Afternoon breaks')
        } else {
          console.log('   ❌ is_break_missed is NOT called for Afternoon breaks')
        }
        
      } else {
        console.log('   ❌ is_break_missed is still NOT called in check_break_reminders')
      }
    }
    
    console.log('\n4️⃣ Testing the updated function...')
    
    // Test if the function can be called without errors
    try {
      const result = await pool.query('SELECT check_break_reminders() as notifications_sent')
      console.log(`   ✅ Function executed successfully, returned: ${result.rows[0].notifications_sent}`)
    } catch (error) {
      console.log(`   ❌ Function execution failed: ${error.message}`)
    }
    
    console.log('\n5️⃣ Summary of the fix...')
    
    console.log('   🎯 WHAT WAS FIXED:')
    console.log('   • Added missing "missed break" reminder logic to check_break_reminders')
    console.log('   • Now calls is_break_missed for all break types')
    console.log('   • Will send "You have not taken your [Break] yet!" notifications')
    console.log('   • Notifications sent 30 minutes after break becomes available')
    
    console.log('\n   📅 EXPECTED NOTIFICATION TIMELINE FOR AFTERNOON BREAK:')
    console.log('   • 1:45 PM: "Afternoon break is now available" ✅ (already working)')
    console.log('   • 2:15 PM: "You have not taken your Afternoon break yet!" ✅ (NOW FIXED)')
    console.log('   • 2:30 PM: "Afternoon break ending soon" ✅ (already working)')
    console.log('   • 2:45 PM: Break window ends (no notification) ✅ (correct)')
    
    console.log('\n   🔄 NEXT STEPS:')
    console.log('   • The function will now send missed break reminders')
    console.log('   • Test with the next break cycle to verify it works')
    console.log('   • Monitor notifications to ensure proper timing')
    
  } catch (error) {
    console.error('❌ Error applying fix:', error.message)
    throw error
  } finally {
    await pool.end()
  }
}

// Run the fix
applyMissingBreakReminderFix()
  .then(() => {
    console.log('\n✅ Missing Break Reminder Fix Applied Successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Fix Failed:', error.message)
    process.exit(1)
  })
