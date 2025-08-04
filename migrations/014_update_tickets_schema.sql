-- Update tickets table schema to match new requirements

-- First, update the ticket_status_enum to include 'For Approval'
ALTER TYPE public.ticket_status_enum ADD VALUE IF NOT EXISTS 'For Approval';

-- Update the default status to 'For Approval'
ALTER TABLE public.tickets ALTER COLUMN status SET DEFAULT 'For Approval'::ticket_status_enum;

-- Add the position column if it doesn't exist
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS "position" int4 DEFAULT 0 NOT NULL;

-- Update existing records to have 'For Approval' status if they are 'pending'
UPDATE public.tickets SET status = 'For Approval'::ticket_status_enum WHERE status = 'pending';

-- Ensure the trigger exists for updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at 
    BEFORE UPDATE ON public.tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Recreate indexes to ensure they exist
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_by ON public.tickets(resolved_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_position ON public.tickets("position"); 