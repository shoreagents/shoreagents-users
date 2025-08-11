-- Drop Ticketing Schema
-- This migration drops the ticketing tables and related objects

-- Drop ticket_comments table first (due to foreign key dependency)
DROP TABLE IF EXISTS public.ticket_comments;

-- Drop ticket_files table (due to foreign key dependency)
DROP TABLE IF EXISTS public.ticket_files;

-- Drop tickets table
DROP TABLE IF EXISTS public.tickets;

-- Drop ticket_categories table
DROP TABLE IF EXISTS public.ticket_categories;

-- Drop the ticket_status_enum type
DROP TYPE IF EXISTS public."ticket_status_enum";

-- Note: The indexes will be automatically dropped when the tables are dropped
-- No need to explicitly drop them
