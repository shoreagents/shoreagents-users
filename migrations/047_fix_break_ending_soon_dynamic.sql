-- Migration 047: Fix break ending soon notification to be dynamic
-- This makes "Break ending soon" show as "Morning break ending soon", "Lunch break ending soon", etc.

-- DROP FUNCTION public.create_break_reminder_notification(int4, text, break_type_enum);

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
              -- FIXED: Now dynamic like other break types
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

-- Add comment for documentation
COMMENT ON FUNCTION public.create_break_reminder_notification(integer, text, break_type_enum) IS 'Updated: Break ending soon notifications now show dynamic break type names';
