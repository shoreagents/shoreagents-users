-- Simple Ticketing System Schema
-- This migration creates the ticketing tables

-- Create ENUM types for tickets
CREATE TYPE IF NOT EXISTS public.ticket_status_enum AS ENUM (
	'pending',
	'in-progress', 
	'resolved'
);

CREATE TYPE IF NOT EXISTS public.ticket_priority_enum AS ENUM (
	'low',
	'medium',
	'high',
	'urgent'
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
	id serial4 NOT NULL,
	ticket_id varchar(50) UNIQUE NOT NULL, -- Custom ticket ID like TKT-xxx
	user_id int4 NOT NULL, -- Agent who created the ticket
	title text NOT NULL,
	concern text NOT NULL,
	details text NULL,
	comments text NULL,
	category varchar(100) NOT NULL,
	status public.ticket_status_enum DEFAULT 'pending' NOT NULL,
	priority public.ticket_priority_enum DEFAULT 'medium' NOT NULL,
	assigned_to int4 NULL, -- Agent assigned to handle the ticket
	resolved_at timestamp NULL,
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT tickets_pkey PRIMARY KEY (id),
	CONSTRAINT tickets_ticket_id_key UNIQUE (ticket_id),
	CONSTRAINT tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
	CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create ticket_files table for file attachments
CREATE TABLE IF NOT EXISTS public.ticket_files (
	id serial4 NOT NULL,
	ticket_id int4 NOT NULL,
	file_name varchar(255) NOT NULL,
	file_path text NULL, -- For future file storage implementation
	file_size bigint NULL,
	uploaded_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT ticket_files_pkey PRIMARY KEY (id),
	CONSTRAINT ticket_files_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE
);

-- Create ticket_comments table for ticket updates/history
CREATE TABLE IF NOT EXISTS public.ticket_comments (
	id serial4 NOT NULL,
	ticket_id int4 NOT NULL,
	user_id int4 NOT NULL,
	comment text NOT NULL,
	is_internal boolean DEFAULT false NOT NULL, -- Internal comments vs public updates
	created_at timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT ticket_comments_pkey PRIMARY KEY (id),
	CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE,
	CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_files_ticket_id ON public.ticket_files(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON public.ticket_comments(user_id); 