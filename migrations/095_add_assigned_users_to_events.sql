-- Migration 095: Add assigned_user_ids array to events table
-- This allows events to be assigned to specific users only

-- Add the assigned_user_ids column as an integer array
ALTER TABLE public.events 
ADD COLUMN assigned_user_ids integer[] DEFAULT NULL;

-- Add comment for the new column
COMMENT ON COLUMN public.events.assigned_user_ids IS 'Array of user IDs who are assigned to this event. If NULL, event is visible to all users.';

-- Create an index on the assigned_user_ids column for better query performance
CREATE INDEX idx_events_assigned_user_ids ON public.events USING GIN (assigned_user_ids);

-- Add a check constraint to ensure assigned_user_ids contains valid user IDs
-- This will be enforced by foreign key relationships in the application layer
ALTER TABLE public.events 
ADD CONSTRAINT events_assigned_user_ids_check 
CHECK (assigned_user_ids IS NULL OR array_length(assigned_user_ids, 1) > 0);

-- Update existing events to be visible to all users (assigned_user_ids = NULL)
-- This maintains backward compatibility
UPDATE public.events 
SET assigned_user_ids = NULL 
WHERE assigned_user_ids IS NULL;

-- Add a function to check if a user is assigned to an event
CREATE OR REPLACE FUNCTION public.is_user_assigned_to_event(
    p_event_id integer,
    p_user_id integer
) RETURNS boolean
LANGUAGE plpgsql
AS $function$
BEGIN
    -- If assigned_user_ids is NULL, event is visible to all users
    IF (SELECT assigned_user_ids FROM public.events WHERE id = p_event_id) IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user_id is in the assigned_user_ids array
    RETURN p_user_id = ANY(
        SELECT assigned_user_ids 
        FROM public.events 
        WHERE id = p_event_id
    );
END;
$function$;

-- Add a function to get events visible to a specific user
CREATE OR REPLACE FUNCTION public.get_events_for_user(
    p_user_id integer
) RETURNS TABLE (
    event_id integer,
    title varchar(255),
    description text,
    event_date date,
    start_time time,
    end_time time,
    location varchar(255),
    status varchar(20),
    event_type varchar(20),
    created_by integer,
    created_at timestamp,
    updated_at timestamp,
    assigned_user_ids integer[]
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id,
        e.title,
        e.description,
        e.event_date,
        e.start_time,
        e.end_time,
        e.location,
        e.status,
        e.event_type,
        e.created_by,
        e.created_at,
        e.updated_at,
        e.assigned_user_ids
    FROM public.events e
    WHERE e.assigned_user_ids IS NULL 
       OR p_user_id = ANY(e.assigned_user_ids)
    ORDER BY e.event_date ASC, e.start_time ASC;
END;
$function$;

-- Add comment for the functions
COMMENT ON FUNCTION public.is_user_assigned_to_event(integer, integer) IS 'Checks if a user is assigned to a specific event. Returns true if assigned_user_ids is NULL (visible to all) or if user_id is in the array.';
COMMENT ON FUNCTION public.get_events_for_user(integer) IS 'Returns all events visible to a specific user (either assigned to them or visible to all users).';
