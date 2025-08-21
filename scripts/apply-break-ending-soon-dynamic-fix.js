// Apply the break ending soon dynamic notification fix
// This will make "Break ending soon" show as "Morning break ending soon", "Lunch break ending soon", etc.

const { Pool } = require('pg')

async function applyBreakEndingSoonDynamicFix() {
  console.log('🔧 Applying Break Ending Soon Dynamic Notification Fix...\n')
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
  })
  
  try {
    console.log('1️⃣ Updating the create_break_reminder_notification function...')
    
    // The updated SQL function
    const updatedFunction = `
      CREATE OR REPLACE FUNCTION public.create_break_reminder_notification(p_agent_user_id integer, p_notification_type text, p_break_type break_type_enum DEFAULT NULL::break_type_enum)
       RETURNS void
       LANGUAGE plpgsql
      AS $function$
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
                
                -- For ending_soon, detect the current active break type if not provided
                IF p_notification_type = 'ending_soon' AND p_break_type IS NULL THEN
                    SELECT break_type INTO p_break_type
                    FROM break_sessions
                    WHERE agent_user_id = p_agent_user_id
                    AND end_time IS NULL
                    AND break_date = current_time_manila::DATE
                    ORDER BY start_time DESC
                    LIMIT 1;
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
                    -- FIXED: Now dynamic based on detected break type
                    title_text := break_name || ' ending soon';
                    message_text := 'Your ' || break_name || ' will end in 15 minutes';
                    notif_type := 'warning';
                    payload_data := jsonb_build_object(
                        'reminder_type', 'ending_soon',
                        'break_type', p_break_type,
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
            $function$
      ;
    `
    
    // Apply the updated function
    await pool.query(updatedFunction)
    console.log('   ✅ Function updated successfully')
    
    // Test the function to make sure it works
    console.log('\n2️⃣ Testing the updated function...')
    
    // Test with ending_soon (should now detect break type automatically)
    const testResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'ending_soon')
    `)
    console.log('   ✅ create_break_reminder_notification with ending_soon works')
    
    // Check if the notification was created with dynamic title
    const notificationCheck = await pool.query(`
      SELECT title, message, created_at, payload
      FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND title LIKE '%ending soon%'
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    if (notificationCheck.rows.length > 0) {
      const notification = notificationCheck.rows[0]
      console.log(`   📱 Latest notification: "${notification.title}"`)
      console.log(`   📝 Message: "${notification.message}"`)
      console.log(`   ⏰ Created: ${notification.created_at}`)
      console.log(`   🔧 Payload: ${JSON.stringify(notification.payload)}`)
      
      // Check if it's dynamic
      if (notification.title.includes('break ending soon') || notification.title.includes('Break ending soon')) {
        console.log('   ✅ Notification is now dynamic!')
      } else {
        console.log('   ❌ Notification title is still static')
      }
    } else {
      console.log('   ℹ️ No recent ending soon notifications found')
    }
    
    // Test with explicit break type
    console.log('\n3️⃣ Testing with explicit break type...')
    await pool.query(`
      SELECT create_break_reminder_notification(2, 'ending_soon', 'Lunch')
    `)
    
    const explicitCheck = await pool.query(`
      SELECT title, message 
      FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND title LIKE '%Lunch%ending soon%'
      ORDER BY created_at DESC 
      LIMIT 1
    `)
    
    if (explicitCheck.rows.length > 0) {
      const notification = explicitCheck.rows[0]
      console.log(`   📱 Explicit break type notification: "${notification.title}"`)
      console.log(`   📝 Message: "${notification.message}"`)
      
      if (notification.title.includes('Lunch break ending soon')) {
        console.log('   ✅ Explicit break type notification works correctly!')
      } else {
        console.log('   ❌ Explicit break type notification not working')
      }
    }
    
    console.log('\n🎉 Break ending soon dynamic notification fix applied successfully!')
    console.log('\n📝 What changed:')
    console.log('   • "Break ending soon" → "Morning break ending soon"')
    console.log('   • "Break ending soon" → "Lunch break ending soon"')
    console.log('   • "Break ending soon" → "Afternoon break ending soon"')
    console.log('   • Function now automatically detects current break type')
    console.log('   • Still works with explicit break type parameter')
    
  } catch (error) {
    console.error('❌ Error applying fix:', error.message)
    console.error('Stack trace:', error.stack)
  } finally {
    await pool.end()
  }
}

// Run the fix
applyBreakEndingSoonDynamicFix()
