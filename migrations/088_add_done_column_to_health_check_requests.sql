-- Add done column to health_check_requests table
-- This column tracks when the user has completed their health check and returned to station

ALTER TABLE public.health_check_requests 
ADD COLUMN done boolean DEFAULT false NOT NULL;

-- Add index for better query performance
CREATE INDEX idx_health_check_requests_done ON public.health_check_requests USING btree (done);

-- Add comment for documentation
COMMENT ON COLUMN public.health_check_requests.done IS 'Indicates if the user has completed their health check and returned to station';
