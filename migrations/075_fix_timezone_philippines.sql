-- Fix timezone to Philippines (UTC+8) for events and activities
-- This migration updates database functions and triggers to use Asia/Manila timezone

-- Update the event status trigger function to use Philippines timezone
CREATE OR REPLACE FUNCTION update_event_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update events to 'today' if event_date is today (Philippines time)
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status = 'upcoming';
    
    -- Update events to 'ended' if event_date is in the past and status is not 'cancelled' (Philippines time)
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE event_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date 
    AND status IN ('upcoming', 'today');
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Update the mark_user_going function to use Philippines timezone
CREATE OR REPLACE FUNCTION mark_user_going(event_id INTEGER, user_email VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Insert or update attendance record with Philippines timezone
    INSERT INTO event_attendance (event_id, user_id, is_going, going_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_going = true,
        going_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila',
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Update the mark_user_back function to use Philippines timezone
CREATE OR REPLACE FUNCTION mark_user_back(event_id INTEGER, user_email VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID
    SELECT id INTO user_id FROM users WHERE email = user_email;
    
    IF user_id IS NULL THEN
        RETURN false;
    END IF;
    
    -- Insert or update attendance record with Philippines timezone
    INSERT INTO event_attendance (event_id, user_id, is_back, back_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_back = true,
        back_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila',
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila';
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Update the create_event function to use Philippines timezone
CREATE OR REPLACE FUNCTION create_event(
    p_title VARCHAR(255),
    p_description TEXT,
    p_event_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_location VARCHAR(255),
    p_created_by_email VARCHAR(255)
)
RETURNS INTEGER AS $$
DECLARE
    user_id INTEGER;
    event_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_created_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to create events';
    END IF;
    
    -- Create event with Philippines timezone
    INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by, created_at, updated_at)
    VALUES (p_title, p_description, p_event_date, p_start_time, p_end_time, p_location, user_id, 
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Update the update_event function to use Philippines timezone
CREATE OR REPLACE FUNCTION update_event(
    p_event_id INTEGER,
    p_title VARCHAR(255),
    p_description TEXT,
    p_event_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_location VARCHAR(255),
    p_status VARCHAR(20),
    p_updated_by_email VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_updated_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to update events';
    END IF;
    
    -- Update event with Philippines timezone
    UPDATE events 
    SET 
        title = p_title,
        description = p_description,
        event_date = p_event_date,
        start_time = p_start_time,
        end_time = p_end_time,
        location = p_location,
        status = p_status,
        updated_at = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila'
    WHERE id = p_event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update the delete_event function to use Philippines timezone
CREATE OR REPLACE FUNCTION delete_event(
    p_event_id INTEGER,
    p_deleted_by_email VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    user_id INTEGER;
BEGIN
    -- Get user ID and check if admin
    SELECT id INTO user_id FROM users WHERE email = p_deleted_by_email AND user_type = 'Internal';
    
    IF user_id IS NULL THEN
        RAISE EXCEPTION 'User not found or not authorized to delete events';
    END IF;
    
    -- Delete event (cascade will handle attendance records)
    DELETE FROM events WHERE id = p_event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update the get_user_events function to return timestamps in Philippines timezone
CREATE OR REPLACE FUNCTION get_user_events(user_email VARCHAR(255))
RETURNS TABLE (
    event_id INTEGER,
    title VARCHAR(255),
    description TEXT,
    event_date DATE,
    start_time TIME,
    end_time TIME,
    location VARCHAR(255),
    status VARCHAR(20),
    created_by_name TEXT,
    is_going BOOLEAN,
    is_back BOOLEAN,
    going_at TIMESTAMP,
    back_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as event_id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        u.email as created_by_name,
        COALESCE(ea.is_going, false) as is_going,
        COALESCE(ea.is_back, false) as is_back,
        ea.going_at AT TIME ZONE 'Asia/Manila' as going_at,
        ea.back_at AT TIME ZONE 'Asia/Manila' as back_at
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = (
        SELECT id FROM users WHERE email = user_email
    )
    ORDER BY e.event_date ASC, e.start_time ASC;
END;
$$ LANGUAGE plpgsql;
