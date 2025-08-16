-- Add supporting_files and file_count columns to tickets table
-- Migration: 029_add_supporting_files_column.sql

-- Add supporting_files column if it doesn't exist
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS supporting_files TEXT[] DEFAULT '{}';

-- Add file_count column if it doesn't exist
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0;

-- Update existing records to have empty arrays for supporting_files
UPDATE public.tickets SET supporting_files = '{}' WHERE supporting_files IS NULL;

-- Update existing records to have 0 for file_count
UPDATE public.tickets SET file_count = 0 WHERE file_count IS NULL;
