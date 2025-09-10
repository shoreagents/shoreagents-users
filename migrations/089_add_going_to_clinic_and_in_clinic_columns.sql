-- Add going_to_clinic and in_clinic columns to health_check_requests table
-- These columns track the user's status in the health check flow

ALTER TABLE public.health_check_requests 
ADD COLUMN going_to_clinic boolean DEFAULT false NOT NULL;

ALTER TABLE public.health_check_requests 
ADD COLUMN in_clinic boolean DEFAULT false NOT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_health_check_requests_going_to_clinic ON public.health_check_requests USING btree (going_to_clinic);
CREATE INDEX idx_health_check_requests_in_clinic ON public.health_check_requests USING btree (in_clinic);

-- Add comments for documentation
COMMENT ON COLUMN public.health_check_requests.going_to_clinic IS 'Indicates if the user is going to the clinic (set by user)';
COMMENT ON COLUMN public.health_check_requests.in_clinic IS 'Indicates if the user is currently in the clinic (set by nurse)';
