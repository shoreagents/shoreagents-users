-- Events & Activities Schema Migration
-- This migration creates tables for managing events and activities

-- Create events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'today', 'cancelled', 'ended')),
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_attendance table to track user attendance
CREATE TABLE event_attendance (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_going BOOLEAN DEFAULT false,
    is_back BOOLEAN DEFAULT false,
    going_at TIMESTAMP,
    back_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, user_id) -- One attendance record per user per event
);

-- Create indexes for better performance
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_event_attendance_event_id ON event_attendance(event_id);
CREATE INDEX idx_event_attendance_user_id ON event_attendance(user_id);

-- Function to update event status based on date
CREATE OR REPLACE FUNCTION update_event_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update events to 'today' if event_date is today
    UPDATE events 
    SET status = 'today', updated_at = CURRENT_TIMESTAMP
    WHERE event_date = CURRENT_DATE 
    AND status = 'upcoming';
    
    -- Update events to 'ended' if event_date is in the past and status is not 'cancelled'
    UPDATE events 
    SET status = 'ended', updated_at = CURRENT_TIMESTAMP
    WHERE event_date < CURRENT_DATE 
    AND status IN ('upcoming', 'today');
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update event status
CREATE TRIGGER trigger_update_event_status
    AFTER INSERT OR UPDATE ON events
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_event_status();

-- Function to get events with attendance for a user
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
        ea.going_at,
        ea.back_at
    FROM events e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.user_id = (
        SELECT id FROM users WHERE email = user_email
    )
    ORDER BY e.event_date ASC, e.start_time ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to mark user as going to an event
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
    
    -- Insert or update attendance record
    INSERT INTO event_attendance (event_id, user_id, is_going, going_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_going = true,
        going_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to mark user as back from an event
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
    
    -- Insert or update attendance record
    INSERT INTO event_attendance (event_id, user_id, is_back, back_at, updated_at)
    VALUES (event_id, user_id, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET 
        is_back = true,
        back_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to create a new event (admin only)
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
    
    -- Create event
    INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by)
    VALUES (p_title, p_description, p_event_date, p_start_time, p_end_time, p_location, user_id)
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update an event (admin only)
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
    
    -- Update event
    UPDATE events 
    SET 
        title = p_title,
        description = p_description,
        event_date = p_event_date,
        start_time = p_start_time,
        end_time = p_end_time,
        location = p_location,
        status = p_status,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_event_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to delete an event (admin only)
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
