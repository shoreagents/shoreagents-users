-- Simple Task Management Schema with Dynamic Statuses
-- This migration creates the task management tables

-- Create ENUM types for tasks (keeping only priority as enum for simplicity)
CREATE TYPE IF NOT EXISTS public.task_priority_enum AS ENUM (
	'low',
	'medium',
	'high'
);

-- Create task_statuses table for dynamic user-defined statuses
CREATE TABLE IF NOT EXISTS public.task_statuses (
	id serial4 NOT NULL,
	user_id int4 NOT NULL, -- Agent who owns this status
	status_name varchar(100) NOT NULL,
	status_color varchar(7) DEFAULT '#6b7280' NOT NULL, -- Hex color for UI display
	status_order int4 DEFAULT 0 NOT NULL, -- Display order
	is_default boolean DEFAULT false NOT NULL, -- Whether this is a default status
	is_completed boolean DEFAULT false NOT NULL, -- Whether tasks with this status are considered done
	description text NULL,
	created_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	updated_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT task_statuses_pkey PRIMARY KEY (id),
	CONSTRAINT task_statuses_user_status_unique UNIQUE (user_id, status_name),
	CONSTRAINT task_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create task_types table for dynamic user-defined task types
CREATE TABLE IF NOT EXISTS public.task_types (
	id serial4 NOT NULL,
	user_id int4 NOT NULL, -- Agent who owns this task type
	type_name varchar(100) NOT NULL,
	type_color varchar(7) DEFAULT '#6b7280' NOT NULL, -- Hex color for UI display
	type_order int4 DEFAULT 0 NOT NULL, -- Display order
	is_default boolean DEFAULT false NOT NULL, -- Whether this is a default type
	description text NULL,
	created_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	updated_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT task_types_pkey PRIMARY KEY (id),
	CONSTRAINT task_types_user_type_unique UNIQUE (user_id, type_name),
	CONSTRAINT task_types_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
	id serial4 NOT NULL,
	task_id varchar(100) UNIQUE NOT NULL, -- Custom task ID like task_xxx
	user_id int4 NOT NULL, -- Agent who owns the task
	task_name varchar(255) NOT NULL,
	assignee varchar(100) NOT NULL,
	status_id int4 NOT NULL, -- Reference to task_statuses table
	priority public.task_priority_enum DEFAULT 'medium' NOT NULL,
	task_type_id int4 NOT NULL, -- Reference to task_types table
	description text NULL,
	due_date date NULL,
	created_by varchar(100) NOT NULL,
	last_edited_by varchar(100) NOT NULL,
	created_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	updated_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT tasks_pkey PRIMARY KEY (id),
	CONSTRAINT tasks_task_id_key UNIQUE (task_id),
	CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
	CONSTRAINT tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.task_statuses(id) ON DELETE RESTRICT,
	CONSTRAINT tasks_task_type_id_fkey FOREIGN KEY (task_type_id) REFERENCES public.task_types(id) ON DELETE RESTRICT
);

-- Create task_files table for file attachments
CREATE TABLE IF NOT EXISTS public.task_files (
	id serial4 NOT NULL,
	task_id int4 NOT NULL,
	file_name varchar(255) NOT NULL,
	file_path text NULL, -- For future file storage implementation
	file_size bigint NULL,
	uploaded_at timestamp DEFAULT (NOW() AT TIME ZONE 'Asia/Manila') NOT NULL,
	CONSTRAINT task_files_pkey PRIMARY KEY (id),
	CONSTRAINT task_files_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE
);

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at 
	BEFORE UPDATE ON public.tasks 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_statuses_updated_at ON public.task_statuses;
CREATE TRIGGER update_task_statuses_updated_at 
	BEFORE UPDATE ON public.task_statuses 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_task_types_updated_at ON public.task_types;
CREATE TRIGGER update_task_types_updated_at 
	BEFORE UPDATE ON public.task_types 
	FOR EACH ROW 
	EXECUTE FUNCTION update_updated_at_column();

-- Helper function to create default statuses for a user
CREATE OR REPLACE FUNCTION public.create_default_task_statuses(p_user_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Insert default statuses if they don't exist for this user
    INSERT INTO task_statuses (user_id, status_name, status_color, status_order, is_default, is_completed, description)
    VALUES 
        (p_user_id, 'Not Started', '#6b7280', 1, true, false, 'Task has not been started yet'),
        (p_user_id, 'In Progress', '#3b82f6', 2, true, false, 'Task is currently being worked on'),
        (p_user_id, 'Done', '#10b981', 3, true, true, 'Task has been completed')
    ON CONFLICT (user_id, status_name) DO NOTHING;
END;
$function$;

-- Helper function to create default task types for a user
CREATE OR REPLACE FUNCTION public.create_default_task_types(p_user_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Insert default task types if they don't exist for this user
    INSERT INTO task_types (user_id, type_name, type_color, type_order, is_default, description)
    VALUES 
        (p_user_id, 'Document', '#8b5cf6', 1, true, 'Documentation and writing tasks'),
        (p_user_id, 'Bug', '#ef4444', 2, true, 'Bug fixes and issue resolution'),
        (p_user_id, 'Feature', '#06b6d4', 3, true, 'New feature development'),
        (p_user_id, 'Polish', '#f59e0b', 4, true, 'UI/UX improvements and refinements')
    ON CONFLICT (user_id, type_name) DO NOTHING;
END;
$function$;

-- Helper function to get status ID by name with fallback
CREATE OR REPLACE FUNCTION public.get_task_status_id(p_user_id integer, p_status_name text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    status_id INTEGER;
BEGIN
    -- Try to find the status for the user
    SELECT id INTO status_id
    FROM task_statuses
    WHERE user_id = p_user_id AND status_name = p_status_name;
    
    -- If not found, create default statuses and try again
    IF status_id IS NULL THEN
        PERFORM create_default_task_statuses(p_user_id);
        
        SELECT id INTO status_id
        FROM task_statuses
        WHERE user_id = p_user_id AND status_name = p_status_name;
    END IF;
    
    -- If still not found, return the first default status
    IF status_id IS NULL THEN
        SELECT id INTO status_id
        FROM task_statuses
        WHERE user_id = p_user_id AND is_default = true
        ORDER BY status_order
        LIMIT 1;
    END IF;
    
    RETURN status_id;
END;
$function$;

-- Helper function to get task type ID by name with fallback
CREATE OR REPLACE FUNCTION public.get_task_type_id(p_user_id integer, p_type_name text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    type_id INTEGER;
BEGIN
    -- Try to find the task type for the user
    SELECT id INTO type_id
    FROM task_types
    WHERE user_id = p_user_id AND type_name = p_type_name;
    
    -- If not found, create default task types and try again
    IF type_id IS NULL THEN
        PERFORM create_default_task_types(p_user_id);
        
        SELECT id INTO type_id
        FROM task_types
        WHERE user_id = p_user_id AND type_name = p_type_name;
    END IF;
    
    -- If still not found, return the first default task type
    IF type_id IS NULL THEN
        SELECT id INTO type_id
        FROM task_types
        WHERE user_id = p_user_id AND is_default = true
        ORDER BY type_order
        LIMIT 1;
    END IF;
    
    RETURN type_id;
END;
$function$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type_id ON public.tasks(task_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_task_id ON public.tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_files_task_id ON public.task_files(task_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_user_id ON public.task_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_task_statuses_name ON public.task_statuses(user_id, status_name);
CREATE INDEX IF NOT EXISTS idx_task_types_user_id ON public.task_types(user_id);
CREATE INDEX IF NOT EXISTS idx_task_types_name ON public.task_types(user_id, type_name); 