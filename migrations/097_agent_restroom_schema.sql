-- Agent Restroom Status Tracking Schema
-- Migration: 097_agent_restroom_schema.sql
-- Description: Creates table to track agent restroom status

-- Create agent_restroom_status table
CREATE TABLE IF NOT EXISTS public.agent_restroom_status (
    id serial4 PRIMARY KEY,
    agent_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_in_restroom BOOLEAN NOT NULL DEFAULT FALSE,
    restroom_count INTEGER NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_restroom_status_agent_user_id 
ON public.agent_restroom_status(agent_user_id);

CREATE INDEX IF NOT EXISTS idx_agent_restroom_status_is_in_restroom 
ON public.agent_restroom_status(is_in_restroom);

-- Create unique constraint to ensure one record per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_restroom_status_unique_agent 
ON public.agent_restroom_status(agent_user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row updates
CREATE TRIGGER update_agent_restroom_status_updated_at
    BEFORE UPDATE ON public.agent_restroom_status
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
