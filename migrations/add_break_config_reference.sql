-- =====================================================
-- ADD BREAK CONFIG REFERENCE TO BREAK SESSIONS
-- =====================================================
-- This migration adds a break_config_id column to break_sessions
-- to properly link sessions to their specific break configuration.
-- This will fix the issue where all break windows show as expired
-- because we can't determine which specific break config to use.
-- =====================================================

-- Add break_config_id column to break_sessions table
ALTER TABLE public.break_sessions 
ADD COLUMN break_config_id int4 NULL;

-- Add foreign key constraint to breaks table
ALTER TABLE public.break_sessions 
ADD CONSTRAINT break_sessions_break_config_id_fkey 
FOREIGN KEY (break_config_id) REFERENCES public.breaks(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX idx_break_sessions_break_config_id ON public.break_sessions USING btree (break_config_id);

-- Update existing break sessions to reference their break configurations
-- This will link existing sessions to the current active break configuration for each user/break_type
UPDATE public.break_sessions 
SET break_config_id = b.id
FROM public.breaks b
WHERE break_sessions.agent_user_id = b.user_id 
  AND break_sessions.break_type = b.break_type 
  AND b.is_active = true;

-- Add comment explaining the new column
COMMENT ON COLUMN public.break_sessions.break_config_id 
IS 'References the specific break configuration (breaks.id) that was used to create this session';

-- Update the mark_expired_breaks function to use break_config_id
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
              SELECT bs.id, bs.agent_user_id, bs.break_type, bs.break_date, bs.break_config_id
              FROM break_sessions bs
              WHERE bs.is_expired = FALSE
              AND (p_user_id IS NULL OR bs.agent_user_id = p_user_id)
              AND bs.break_date = CURRENT_DATE
              AND bs.break_config_id IS NOT NULL
              AND is_break_window_expired(bs.agent_user_id, bs.break_type)
          LOOP
              -- Mark the break session as expired
              UPDATE break_sessions 
              SET is_expired = TRUE
              WHERE id = break_record.id;
              
              expired_count := expired_count + 1;
          END LOOP;
          
          -- Second, create missed break sessions for expired break windows
          -- BUT only if the user doesn't already have a session for that break type today
          FOR user_break IN
              SELECT DISTINCT b.id, b.user_id, b.break_type, b.start_time, b.end_time, b.duration_minutes
              FROM breaks b
              WHERE b.is_active = true
              AND (p_user_id IS NULL OR b.user_id = p_user_id)
              AND is_break_window_expired(b.user_id, b.break_type)
              AND NOT EXISTS (
                  -- Check if user already has ANY session for this break type today (expired or not)
                  SELECT 1 FROM break_sessions bs2 
                  WHERE bs2.agent_user_id = b.user_id 
                  AND bs2.break_type = b.break_type 
                  AND bs2.break_date = CURRENT_DATE
              )
          LOOP
              -- Create a missed break session with proper break_config_id reference
              INSERT INTO break_sessions (
                  agent_user_id, 
                  break_type, 
                  start_time, 
                  end_time, 
                  duration_minutes, 
                  break_date, 
                  is_expired,
                  break_config_id,
                  created_at
              ) VALUES (
                  user_break.user_id,
                  user_break.break_type,
                  (CURRENT_DATE + user_break.start_time)::timestamp, -- Start time for today
                  (CURRENT_DATE + user_break.start_time)::timestamp, -- End time = start time (no duration used)
                  0, -- Duration is 0 because user didn't take the break
                  CURRENT_DATE,
                  TRUE, -- Mark as expired immediately
                  user_break.id, -- Reference to the specific break configuration
                  NOW()
              );
              
              missed_count := missed_count + 1;
          END LOOP;
          
          RETURN expired_count + missed_count;
      END;
$function$;

COMMENT ON FUNCTION public.mark_expired_breaks(integer) 
IS 'Marks expired break sessions as expired AND creates missed break sessions for expired break windows. Uses break_config_id to properly reference break configurations.';

-- Update the is_break_session_expired function to use break_config_id
CREATE OR REPLACE FUNCTION public.is_break_session_expired(p_session_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
      DECLARE
          session_record RECORD;
      BEGIN
          -- Get the break session with its break configuration
          SELECT bs.is_expired, bs.agent_user_id, bs.break_type, bs.break_date, bs.end_time, bs.break_config_id
          INTO session_record
          FROM break_sessions bs
          WHERE bs.id = p_session_id;
          
          IF NOT FOUND THEN
              RETURN FALSE;
          END IF;
          
          -- If already marked as expired, return true
          IF session_record.is_expired THEN
              RETURN TRUE;
          END IF;
          
          -- Only check window expiration for incomplete sessions (no end_time)
          -- Completed sessions should not be marked as expired just because the window passed
          IF session_record.end_time IS NULL THEN
              -- Check if the break window expired on the session's date, not today
              RETURN is_break_window_expired(session_record.agent_user_id, session_record.break_type, 
                  (session_record.break_date + INTERVAL '23:59:59') AT TIME ZONE 'Asia/Manila');
          END IF;
          
          -- Completed sessions are not expired
          RETURN FALSE;
      END;
$function$;

COMMENT ON FUNCTION public.is_break_session_expired(integer) 
IS 'Checks if a specific break session is expired using break_config_id reference';
