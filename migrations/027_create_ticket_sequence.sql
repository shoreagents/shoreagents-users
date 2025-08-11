-- Create ticket_id_seq sequence for auto-generating ticket IDs
-- This sequence is used by the generate_ticket_id() function

CREATE SEQUENCE IF NOT EXISTS public.ticket_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Set the sequence to be owned by the tickets table
ALTER SEQUENCE public.ticket_id_seq OWNED BY public.tickets.id;

-- Add comment for documentation
COMMENT ON SEQUENCE public.ticket_id_seq IS 'Sequence for auto-generating ticket IDs';
