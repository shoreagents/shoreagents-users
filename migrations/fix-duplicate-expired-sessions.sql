-- Fix: Prevent duplicate expired break session creation
-- The issue was that mark_expired_breaks() was creating multiple missed sessions
-- for the same break type on the same day because it only checked for non-expired sessions

CREATE OR REPLACE FUNCTION public.mark_expired_breaks(p_user_id integer DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $function$
      DECLARE
          break_record RECORD;
          user_break RECORD;
          expired_count INTEGER := 0;
          missed_count INTEGER := 0;
      BEGIN
          -- First, mark existing break sessions as expired
          FOR break_record IN
              SELECT bs.id, bs.agent_user_id, bs.break_type, bs.break_date
              FROM break_sessions bs
              WHERE bs.is_expired = FALSE
              AND (p_user_id IS NULL OR bs.agent_user_id = p_user_id)
              AND bs.break_date = CURRENT_DATE
              AND is_break_window_expired(bs.agent_user_id, bs.break_type)
          LOOP
              -- Mark the break session as expired
              UPDATE break_sessions 
              SET is_expired = TRUE
              WHERE id = break_record.id;
              
              expired_count := expired_count + 1;
          END LOOP;
          
          -- Second, create missed break sessions for expired break windows
          -- BUT only if the user doesn't already have ANY session for that break type today
          FOR user_break IN
              SELECT DISTINCT b.user_id, b.break_type, b.start_time, b.end_time, b.duration_minutes
              FROM breaks b
              WHERE b.is_active = true
              AND (p_user_id IS NULL OR b.user_id = p_user_id)
              AND is_break_window_expired(b.user_id, b.break_type)
              AND NOT EXISTS (
                  -- Check if user already has ANY session for this break type today
                  -- (expired or not - we only want one missed session per break type per day)
                  SELECT 1 FROM break_sessions bs2 
                  WHERE bs2.agent_user_id = b.user_id 
                  AND bs2.break_type = b.break_type 
                  AND bs2.break_date = CURRENT_DATE
              )
          LOOP
              -- Create a missed break session
              INSERT INTO break_sessions (
                  agent_user_id, 
                  break_type, 
                  start_time, 
                  end_time, 
                  duration_minutes, 
                  break_date, 
                  is_expired,
                  created_at
              ) VALUES (
                  user_break.user_id,
                  user_break.break_type,
                  (CURRENT_DATE + user_break.start_time)::timestamp, -- Start time for today
                  (CURRENT_DATE + user_break.start_time)::timestamp, -- End time = start time (no duration used)
                  0, -- Duration is 0 because user didn't take the break
                  CURRENT_DATE,
                  TRUE, -- Mark as expired immediately
                  NOW()
              );
              
              missed_count := missed_count + 1;
          END LOOP;
          
          RETURN expired_count + missed_count;
      END;
$function$;

COMMENT ON FUNCTION public.mark_expired_breaks(integer) 
    IS 'FIXED: Now prevents duplicate missed break sessions. Only creates one missed session per break type per day.';
