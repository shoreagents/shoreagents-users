-- Debug version of precreate_next_day_activity_rows function
-- This version will log every step to help us understand what's happening

CREATE OR REPLACE FUNCTION public.precreate_next_day_activity_rows_debug(
    p_check_time TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    created_count INTEGER := 0;
    manila_date DATE;
    next_date DATE;
    start_time_tok TEXT;
    end_time_tok TEXT;
    start_minutes INTEGER;
    end_minutes INTEGER;
    now_minutes INTEGER;
    shift_text TEXT;
    is_day_shift BOOLEAN;
    shift_has_both BOOLEAN;
    debug_info TEXT;
BEGIN
    -- Convert to Manila time and get dates
    manila_date := (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')::date;
    next_date := manila_date + INTERVAL '1 day';
    
    RAISE NOTICE 'DEBUG: manila_date = %, next_date = %', manila_date, next_date;
    
    -- Get current time in Manila timezone, converted to minutes since midnight
    now_minutes := EXTRACT(HOUR FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila')) * 60 + 
                   EXTRACT(MINUTE FROM (p_check_time AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila'));
    
    RAISE NOTICE 'DEBUG: now_minutes = %', now_minutes;
    
    -- Loop through all agents
    FOR rec IN (
        SELECT u.id AS user_id, ji.shift_time
        FROM users u
        JOIN agents a ON a.user_id = u.id
        LEFT JOIN job_info ji ON ji.agent_user_id = u.id
        WHERE u.user_type = 'Agent'
    ) LOOP
        RAISE NOTICE 'DEBUG: Processing user_id = %, shift_time = %', rec.user_id, rec.shift_time;
        
        shift_text := COALESCE(rec.shift_time, '');
        shift_has_both := false;
        start_minutes := NULL; 
        end_minutes := NULL;

        -- Parse times like "6:00 AM - 1:36 PM"
        IF shift_text ~* '(\d{1,2}:\d{2}\s*(AM|PM)).*-\s*(\d{1,2}:\d{2}\s*(AM|PM))' THEN
            shift_has_both := true;
            start_time_tok := regexp_replace(shift_text, '^.*?(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
            end_time_tok := regexp_replace(shift_text, '^.*-\s*(\d{1,2}:\d{2}\s*(AM|PM)).*$', '\1', 1, 0, 'i');
            RAISE NOTICE 'DEBUG: Parsed start_time_tok = %, end_time_tok = %', start_time_tok, end_time_tok;
        ELSE
            RAISE NOTICE 'DEBUG: Could not parse shift_text = %', shift_text;
            CONTINUE;
        END IF;

        -- Convert start time to minutes
        IF start_time_tok IS NOT NULL THEN
            start_minutes := (
                CASE UPPER(split_part(start_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(start_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(start_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(start_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(start_time_tok, ' ', 1), ':', 2)::INT
                END
            );
            RAISE NOTICE 'DEBUG: start_minutes = %', start_minutes;
        END IF;
        
        -- Convert end time to minutes
        IF end_time_tok IS NOT NULL THEN
            end_minutes := (
                CASE UPPER(split_part(end_time_tok, ' ', 2))
                    WHEN 'AM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT % 12 = 0 THEN 0 
                         ELSE split_part(end_time_tok, ':', 1)::INT END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                    WHEN 'PM' THEN 
                        (CASE WHEN split_part(end_time_tok, ':', 1)::INT = 12 THEN 12 
                         ELSE split_part(end_time_tok, ':', 1)::INT + 12 END) * 60 + 
                        split_part(split_part(end_time_tok, ' ', 1), ':', 2)::INT
                END
            );
            RAISE NOTICE 'DEBUG: end_minutes = %', end_minutes;
        END IF;

        -- Skip if we couldn't parse the times
        IF start_minutes IS NULL OR end_minutes IS NULL THEN
            RAISE NOTICE 'DEBUG: Skipping - could not parse times';
            CONTINUE;
        END IF;

        -- Determine if this is a day shift (end > start) or night shift (end < start)
        is_day_shift := end_minutes > start_minutes;
        RAISE NOTICE 'DEBUG: is_day_shift = %', is_day_shift;

        -- Check if shift has ended
        IF is_day_shift THEN
            -- Day shift: ended if current time >= end time
            IF now_minutes < end_minutes THEN
                RAISE NOTICE 'DEBUG: Day shift not yet ended - now_minutes (%) < end_minutes (%)', now_minutes, end_minutes;
                CONTINUE; -- shift not yet ended
            ELSE
                RAISE NOTICE 'DEBUG: Day shift has ended - now_minutes (%) >= end_minutes (%)', now_minutes, end_minutes;
            END IF;
        ELSE
            -- Night shift: end is next day; ended if current time >= end time (past midnight)
            IF now_minutes < end_minutes THEN
                RAISE NOTICE 'DEBUG: Night shift not yet ended - now_minutes (%) < end_minutes (%)', now_minutes, end_minutes;
                CONTINUE; -- shift not yet ended
            ELSE
                RAISE NOTICE 'DEBUG: Night shift has ended - now_minutes (%) >= end_minutes (%)', now_minutes, end_minutes;
            END IF;
        END IF;

        -- Check if row already exists for next day
        IF EXISTS (
            SELECT 1 FROM activity_data 
            WHERE user_id = rec.user_id AND today_date = next_date
        ) THEN
            RAISE NOTICE 'DEBUG: Row already exists for user % on date % - skipping', rec.user_id, next_date;
            CONTINUE; -- row already exists, skip
        ELSE
            RAISE NOTICE 'DEBUG: No existing row found for user % on date % - will create', rec.user_id, next_date;
        END IF;

        -- Create new row for next day
        BEGIN
            RAISE NOTICE 'DEBUG: Attempting to INSERT for user % on date %', rec.user_id, next_date;
            
            INSERT INTO activity_data (
                user_id, 
                is_currently_active, 
                last_session_start, 
                today_date, 
                today_active_seconds, 
                today_inactive_seconds, 
                updated_at
            ) VALUES (
                rec.user_id, 
                FALSE, 
                NULL, 
                next_date::text, 
                0, 
                0, 
                p_check_time
            );
            
            -- If we get here, the insert was successful
            created_count := created_count + 1;
            RAISE NOTICE 'DEBUG: SUCCESS! Inserted row for user % on date %. Total created: %', rec.user_id, next_date, created_count;
            
        EXCEPTION WHEN OTHERS THEN
            -- Log error and continue with next user
            RAISE WARNING 'DEBUG: Error creating row for user %: %', rec.user_id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE NOTICE 'DEBUG: Function completed. Total rows created: %', created_count;
    RETURN created_count;
END;
$$;
