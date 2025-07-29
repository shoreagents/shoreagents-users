-- Simple Ticketing System Schema
-- This migration creates the ticketing tables

-- Create ENUM types for tickets
CREATE TYPE IF NOT EXISTS public.ticket_status_enum AS ENUM (
	'pending',
	'in-progress', 
	'resolved',
	'on-hold'
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
	id serial4 NOT NULL,
	ticket_id varchar(50) UNIQUE NOT NULL, -- Custom ticket ID like TKT-xxx
	user_id int4 NOT NULL, -- Agent who created the ticket
	concern text NOT NULL,
	details text NULL,
	category varchar(100) NOT NULL,
	status public.ticket_status_enum DEFAULT 'pending' NOT NULL,
	resolved_by int4 NULL, -- Agent who resolved the ticket
	resolved_at timestamp NULL,
	created_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	updated_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT tickets_pkey PRIMARY KEY (id),
	CONSTRAINT tickets_ticket_id_key UNIQUE (ticket_id),
	CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
	CONSTRAINT tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create ticket_files table for file attachments
CREATE TABLE IF NOT EXISTS public.ticket_files (
	id serial4 NOT NULL,
	ticket_id int4 NOT NULL,
	file_name varchar(255) NOT NULL,
	file_path text NULL, -- For future file storage implementation
	file_size bigint NULL,
	uploaded_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT ticket_files_pkey PRIMARY KEY (id),
	CONSTRAINT ticket_files_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE
);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_tickets_updated_at ON public.tickets;
CREATE TRIGGER update_tickets_updated_at 
	BEFORE UPDATE ON public.tickets 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_resolved_by ON public.tickets(resolved_by);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON public.ticket_files(ticket_id); 