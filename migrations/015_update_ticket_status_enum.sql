-- Update ticket_status_enum with new values
-- First, drop the existing enum type
DROP TYPE IF EXISTS public."ticket_status_enum" CASCADE;

-- Create the new enum with updated values
CREATE TYPE public."ticket_status_enum" AS ENUM (
    'For Approval',
    'On Hold',
    'In Progress',
    'Approved',
    'Completed'
);

-- Update the tickets table to use the new enum
ALTER TABLE public.tickets ALTER COLUMN status TYPE public."ticket_status_enum" USING 
    CASE 
        WHEN status::text = 'pending' THEN 'For Approval'::public."ticket_status_enum"
        WHEN status::text = 'in-progress' THEN 'In Progress'::public."ticket_status_enum"
        WHEN status::text = 'resolved' THEN 'Completed'::public."ticket_status_enum"
        WHEN status::text = 'on-hold' THEN 'On Hold'::public."ticket_status_enum"
        ELSE 'For Approval'::public."ticket_status_enum"
    END;

-- Set default status to 'For Approval'
ALTER TABLE public.tickets ALTER COLUMN status SET DEFAULT 'For Approval'::public."ticket_status_enum"; 