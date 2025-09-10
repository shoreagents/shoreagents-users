-- Fix infinite loop in meeting scheduler when user is in an event
-- This migration updates the check_and_start_scheduled_meetings function to handle
-- the case where a meeting can't start because the user is in an event

CREATE OR REPLACE FUNCTION public.check_and_start_scheduled_meetings()
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
    meetings_started INTEGER := 0;
    meeting_record RECORD;
    start_result JSON;
    activity_check RECORD;
BEGIN
    -- Find meetings that are scheduled and should start now
    FOR meeting_record IN
        SELECT id, title, agent_user_id, start_time
        FROM meetings
        WHERE status = 'scheduled'
        AND start_time <= NOW()
        AND start_time > NOW() - INTERVAL '24 hours' -- Only start meetings within the last 24 hours to avoid starting very old meetings
    LOOP
        -- Check if user is currently in an activity/event BEFORE trying to start
        SELECT ea.is_going, e.title as event_title, e.event_type
        INTO activity_check
        FROM event_attendance ea
        JOIN events e ON ea.event_id = e.id
        WHERE ea.user_id = meeting_record.agent_user_id
        AND ea.is_going = true
        AND ea.is_back = false
        AND e.status NOT IN ('cancelled', 'ended');

        IF FOUND THEN
            -- User is currently in an activity/event, skip this meeting
            -- Don't log this as an error since it's expected behavior
            RAISE NOTICE 'Skipping meeting % (ID: %) - user is in %: %', 
                meeting_record.title, 
                meeting_record.id, 
                LOWER(activity_check.event_type), 
                activity_check.event_title;
            CONTINUE; -- Skip to next meeting
        END IF;

        -- Try to start the meeting using the existing start_meeting function with automatic flag
        BEGIN
            -- Call the start_meeting function with is_automatic = true
            SELECT start_meeting(meeting_record.id, meeting_record.agent_user_id, true) INTO start_result;
            
            -- Check if the meeting was successfully started
            IF (start_result->>'success')::boolean THEN
                meetings_started := meetings_started + 1;
                RAISE NOTICE 'Automatically started meeting: % (ID: %)', meeting_record.title, meeting_record.id;
            ELSE
                -- Log the reason why the meeting couldn't start
                RAISE NOTICE 'Could not start meeting % (ID: %): %', 
                    meeting_record.title, 
                    meeting_record.id, 
                    start_result->>'message';
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                -- Log any unexpected errors but continue processing other meetings
                RAISE NOTICE 'Unexpected error starting meeting % (ID: %): %', 
                    meeting_record.title, 
                    meeting_record.id, 
                    SQLERRM;
        END;
    END LOOP;

    RETURN meetings_started;
END;
$function$;
