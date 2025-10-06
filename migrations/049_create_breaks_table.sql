-- =====================================================
-- CREATE BREAKS TABLE FOR USER-SPECIFIC BREAK TIMES
-- =====================================================
-- This table stores custom break time settings for each user
-- If a user hasn't set custom times, they will see "Set schedule" instead of break buttons
-- =====================================================

-- Create breaks table
CREATE TABLE public.breaks (
    id serial4 NOT NULL,
    user_id int4 NOT NULL,
    break_type public."break_type_enum" NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    duration_minutes int4 NOT NULL,
    is_active bool DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT breaks_pkey PRIMARY KEY (id),
    CONSTRAINT breaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT breaks_break_type_check CHECK ((break_type = ANY (ARRAY['Morning'::break_type_enum, 'Lunch'::break_type_enum, 'Afternoon'::break_type_enum, 'NightFirst'::break_type_enum, 'NightMeal'::break_type_enum, 'NightSecond'::break_type_enum]))),
    CONSTRAINT breaks_time_validation CHECK (end_time > start_time),
    CONSTRAINT breaks_duration_positive CHECK (duration_minutes > 0)
);

-- Create indexes for better performance
CREATE INDEX idx_breaks_user_id ON public.breaks USING btree (user_id);
CREATE INDEX idx_breaks_break_type ON public.breaks USING btree (break_type);
CREATE INDEX idx_breaks_user_break_type ON public.breaks USING btree (user_id, break_type);
CREATE INDEX idx_breaks_is_active ON public.breaks USING btree (is_active);

-- Create unique constraint to ensure one active break setting per user per break type
CREATE UNIQUE INDEX idx_breaks_user_break_type_unique 
    ON public.breaks USING btree (user_id, break_type) 
    WHERE is_active = true;

-- Add triggers
CREATE TRIGGER update_breaks_updated_at 
    BEFORE UPDATE ON public.breaks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if user has custom break settings
CREATE OR REPLACE FUNCTION public.user_has_custom_breaks(p_user_id integer)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    break_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO break_count
    FROM public.breaks
    WHERE user_id = p_user_id
    AND is_active = true;
    
    RETURN break_count > 0;
END;
$function$;


-- Function to get user's custom break settings
CREATE OR REPLACE FUNCTION public.get_user_custom_breaks(p_user_id integer)
RETURNS TABLE(
    break_type public."break_type_enum",
    start_time time,
    end_time time,
    duration_minutes integer
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        b.break_type,
        b.start_time,
        b.end_time,
        b.duration_minutes
    FROM public.breaks b
    WHERE b.user_id = p_user_id
    AND b.is_active = true
    ORDER BY b.break_type;
END;
$function$;


-- Function to set user's custom break times
CREATE OR REPLACE FUNCTION public.set_user_custom_breaks(
    p_user_id integer,
    p_break_settings jsonb
)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
DECLARE
    break_setting jsonb;
    break_type_text text;
    break_type_enum public."break_type_enum";
BEGIN
    -- First, deactivate all existing break settings for this user
    UPDATE public.breaks 
    SET is_active = false, updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Insert new break settings
    FOR break_setting IN SELECT * FROM jsonb_array_elements(p_break_settings)
    LOOP
        break_type_text := break_setting->>'break_type';
        
        -- Convert text to enum
        break_type_enum := break_type_text::public."break_type_enum";
        
        -- Insert new break setting
        INSERT INTO public.breaks (
            user_id,
            break_type,
            start_time,
            end_time,
            duration_minutes,
            is_active
        ) VALUES (
            p_user_id,
            break_type_enum,
            (break_setting->>'start_time')::time,
            (break_setting->>'end_time')::time,
            (break_setting->>'duration_minutes')::integer,
            true
        );
    END LOOP;
    
    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$function$;


-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Uncomment to add sample data for testing
/*
INSERT INTO public.breaks (user_id, break_type, start_time, end_time, duration_minutes) VALUES
(1, 'Morning', '08:00', '09:00', 15),
(1, 'Lunch', '12:00', '13:00', 60),
(1, 'Afternoon', '15:00', '16:00', 15);
*/
